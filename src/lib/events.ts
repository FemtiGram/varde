import { CORRIDORS, SCORING, THRESHOLDS, ZONES } from "./config";
import { haversineMetres, pointInPolygon, projectPosition } from "./geo";
import { getEnrichment, flagFromMmsi } from "./risk";
import { maxPlausibleSpeed } from "./ship-types";
import type {
  Contact,
  EventSeverity,
  EventType,
  InfrastructureCorridor,
  MonitoringZone,
  OperatorEvent,
  PositionReport,
  ScoreFactor,
} from "./types";

/**
 * Pure derivation: (contact tracks, zones, corridors, now) -> active events,
 * each with an explainable factor-based priority score.
 *
 * Decision state (acknowledged/dismissed/escalated) is layered on top by the
 * store, keyed on the stable event id, so re-derivation never wipes a decision.
 *
 * The two threat signatures from the brief:
 *  - Shadow fleet: AIS gap / AIS jump, aggravated by a risky vessel profile.
 *  - Cable threat: sustained low speed inside an infrastructure corridor —
 *    its own event type, scored above a generic loiter.
 */

export function eventId(type: EventType, contactId: string, zoneId: string | null) {
  return `${type}:${contactId}:${zoneId ?? ""}`;
}

function minutesBetween(aIso: string, bIso: string): number {
  return Math.abs(new Date(bIso).getTime() - new Date(aIso).getTime()) / 60_000;
}

function inPoly(p: PositionReport, area: MonitoringZone | InfrastructureCorridor) {
  return pointInPolygon([p.longitude, p.latitude], area.polygon);
}

const TYPE_BASE_LABELS: Record<EventType, string> = {
  "dark-contact": "Grunnscore: kontakt uten AIS",
  "infra-approach": "Grunnscore: kurs mot infrastruktur",
  "cable-loiter": "Grunnscore: lav fart i kabelkorridor",
  "ais-jump": "Grunnscore: AIS-sprang",
  "ais-gap": "Grunnscore: AIS-bortfall",
  "zone-entry": "Grunnscore: soneinngang",
  loitering: "Grunnscore: lav fart i sone",
};

interface FactorContext {
  type: EventType;
  contact: Contact;
  position: PositionReport;
  startedAt: string;
  now: Date;
  /** Extra type-specific aggravators, already built by the detector */
  extra?: ScoreFactor[];
}

/** Build the full, explainable factor list for an event. */
function buildFactors(ctx: FactorContext): ScoreFactor[] {
  const F = SCORING.factors;
  const factors: ScoreFactor[] = [
    { id: "base", label: TYPE_BASE_LABELS[ctx.type], points: SCORING.base[ctx.type] },
  ];

  // Proximity to critical infrastructure / monitoring zones
  const corridor = CORRIDORS.find((c) => inPoly(ctx.position, c));
  if (corridor && ctx.type !== "cable-loiter") {
    // cable-loiter's corridor context is part of its base score
    factors.push({
      id: "infra",
      label: `Ved infrastruktur: ${corridor.name}`,
      points: F.nearInfrastructure,
    });
  } else if (ctx.type === "cable-loiter") {
    factors.push({
      id: "infra",
      label: "Inne i kabelkorridor",
      points: F.nearInfrastructure,
    });
  }
  const zone = ZONES.find((z) => inPoly(ctx.position, z));
  if (zone) {
    factors.push({ id: "zone", label: `I ${zone.name}`, points: F.inZone });
  }

  // Vessel risk profile (illustrative enrichment exists only for constructed vessels)
  const enrichment = getEnrichment(ctx.contact);
  const flag = flagFromMmsi(ctx.contact.mmsi);
  if (enrichment?.sanctionsMatch) {
    factors.push({
      id: "sanctions",
      label: "Sanksjonstreff (illustrativ)",
      points: F.sanctionsMatch,
    });
  }
  if (flag?.risky) {
    factors.push({
      id: "flag",
      label: `Flaggstat ${flag.country ?? flag.mid} (forenklet liste)`,
      points: F.riskyFlag,
    });
  }
  if (enrichment?.insurance === "utløpt") {
    factors.push({
      id: "insurance",
      label: "Forsikring utløpt (illustrativ)",
      points: F.insuranceLapsed,
    });
  }

  // Non-AIS source
  if (ctx.contact.source !== "ais") {
    factors.push({
      id: "source",
      label: "Detektert uten AIS-identitet",
      points: F.nonAisSource,
    });
  }

  if (ctx.extra) factors.push(...ctx.extra);

  // Recency: fresh events float, aging ones sink
  const ageMin = (ctx.now.getTime() - new Date(ctx.startedAt).getTime()) / 60_000;
  const recency = Math.round(
    SCORING.recencyMax * Math.max(0, 1 - ageMin / SCORING.recencyWindowMinutes)
  );
  if (recency > 0) {
    factors.push({ id: "recency", label: "Nylig oppstått", points: recency });
  }

  return factors;
}

function severityFromScore(score: number): EventSeverity {
  if (score >= SCORING.severity.critical) return "critical";
  if (score >= SCORING.severity.warning) return "warning";
  return "info";
}

type Derived = Omit<OperatorEvent, "decision" | "decidedAt" | "decidedBy">;

function makeEvent(
  ctx: FactorContext,
  zoneId: string | null,
  updatedAt: string,
  reason: string
): Derived {
  const factors = buildFactors(ctx);
  const score = factors.reduce((sum, f) => sum + f.points, 0);
  return {
    id: eventId(ctx.type, ctx.contact.id, zoneId),
    type: ctx.type,
    severity: severityFromScore(score),
    contactId: ctx.contact.id,
    contactName: ctx.contact.name,
    mmsi: ctx.contact.mmsi,
    zoneId,
    startedAt: ctx.startedAt,
    updatedAt,
    reason,
    score,
    factors,
    active: true,
  };
}

function fmtClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtSpeed(sog: number | null): string {
  return sog == null ? "ukjent fart" : `${sog.toFixed(1)} kn`;
}

/* ------------------------------- Detectors ------------------------------- */

function detectAisGap(contact: Contact, now: Date): Derived | null {
  if (contact.source !== "ais") return null;
  const silentMin =
    (now.getTime() - new Date(contact.latest.msgtime).getTime()) / 60_000;
  if (silentMin < THRESHOLDS.aisGapMinutes || silentMin > THRESHOLDS.aisGapExpireMinutes) {
    return null;
  }
  const extra: ScoreFactor[] =
    silentMin > 30
      ? [{ id: "long-gap", label: "Mørk i over 30 min", points: SCORING.factors.longGap }]
      : [];
  return makeEvent(
    {
      type: "ais-gap",
      contact,
      position: contact.latest,
      startedAt: contact.latest.msgtime,
      now,
      extra,
    },
    null,
    now.toISOString(),
    `Ingen AIS-posisjon på ${Math.round(silentMin)} min. Sist rapportert i ${fmtSpeed(
      contact.latest.speedOverGround
    )} kl. ${fmtClock(contact.latest.msgtime)}.`
  );
}

/** Shadow-fleet signature B: a position the vessel could not physically have reached. */
function detectAisJump(contact: Contact, now: Date): Derived | null {
  if (contact.source !== "ais" || contact.track.length < 2) return null;
  const maxKnots = maxPlausibleSpeed(contact.shipType);
  let jump: { from: PositionReport; to: PositionReport; impliedKnots: number } | null =
    null;
  for (let i = contact.track.length - 1; i >= 1; i--) {
    const a = contact.track[i - 1];
    const b = contact.track[i];
    const dtH =
      (new Date(b.msgtime).getTime() - new Date(a.msgtime).getTime()) / 3_600_000;
    if (dtH <= 0) continue;
    const metres = haversineMetres(
      [a.longitude, a.latitude],
      [b.longitude, b.latitude]
    );
    const impliedKnots = metres / 1852 / dtH;
    if (
      metres >= THRESHOLDS.jumpMinMetres &&
      impliedKnots > maxKnots * THRESHOLDS.jumpSpeedFactor
    ) {
      jump = { from: a, to: b, impliedKnots };
      break; // most recent jump wins; the id keeps it as one event
    }
  }
  if (!jump) return null;
  const nm = haversineMetres(
    [jump.from.longitude, jump.from.latitude],
    [jump.to.longitude, jump.to.latitude]
  ) / 1852;
  const extra: ScoreFactor[] =
    jump.impliedKnots > maxKnots * 2
      ? [
          {
            id: "extreme-jump",
            label: "Fysisk umulig forflytning",
            points: SCORING.factors.extremeJump,
          },
        ]
      : [];
  return makeEvent(
    {
      type: "ais-jump",
      contact,
      position: jump.to,
      startedAt: jump.to.msgtime,
      now,
      extra,
    },
    null,
    now.toISOString(),
    `Posisjonssprang på ${nm.toFixed(1)} nm kl. ${fmtClock(
      jump.to.msgtime
    )} — tilsvarer ${Math.round(jump.impliedKnots)} kn (maks plausibelt ${maxKnots} kn). Mulig spoofing.`
  );
}

/** Start of the current contiguous slow-and-inside period, or null. */
function findSlowInsideStart(
  track: PositionReport[],
  area: MonitoringZone | InfrastructureCorridor
): string | null {
  let start: string | null = null;
  for (let i = track.length - 1; i >= 0; i--) {
    const p = track[i];
    const slow =
      p.speedOverGround != null &&
      p.speedOverGround <= THRESHOLDS.loiterMaxSpeedKnots;
    if (slow && inPoly(p, area)) {
      start = p.msgtime;
    } else {
      break;
    }
  }
  return start;
}

/** Cable-threat signature: sustained low speed inside an infrastructure corridor. */
function detectCableLoiter(contact: Contact, now: Date): Derived[] {
  const events: Derived[] = [];
  const latest = contact.latest;
  for (const corridor of CORRIDORS) {
    if (!inPoly(latest, corridor)) continue;
    const slowSince = findSlowInsideStart(contact.track, corridor);
    if (
      !slowSince ||
      minutesBetween(slowSince, latest.msgtime) < THRESHOLDS.cableLoiterMinMinutes
    ) {
      continue;
    }
    // How far the contact has moved while slow — the anchor-drag tell
    const slowTrack = contact.track.filter((p) => p.msgtime >= slowSince);
    const draggedNm =
      slowTrack.length > 1
        ? haversineMetres(
            [slowTrack[0].longitude, slowTrack[0].latitude],
            [latest.longitude, latest.latitude]
          ) / 1852
        : 0;
    const minutes = Math.round(minutesBetween(slowSince, latest.msgtime));
    const extra: ScoreFactor[] =
      minutes > 30
        ? [
            {
              id: "long-loiter",
              label: "Vedvarende i over 30 min",
              points: SCORING.factors.longLoiter,
            },
          ]
        : [];
    events.push(
      makeEvent(
        { type: "cable-loiter", contact, position: latest, startedAt: slowSince, now, extra },
        corridor.id,
        latest.msgtime,
        `Under ${THRESHOLDS.loiterMaxSpeedKnots} kn i ${corridor.name} i ${minutes} min` +
          (draggedNm > 0.15
            ? `, forflyttet ${draggedNm.toFixed(1)} nm langs korridoren — mønster forenlig med ankerdragging.`
            : ".")
      )
    );
  }
  return events;
}

/**
 * Predicted infrastructure approach (CPA-style, deliberately simple): dead-
 * reckon the current course/speed forward and find the first projected entry
 * into a corridor. Gated hard against transit noise — every fairway crossing
 * passes over the corridors, so an approach is only an event when the vessel
 * is creeping (pre-drag posture) or carries an elevated risk profile.
 */
function detectInfraApproach(contact: Contact, now: Date): Derived[] {
  const events: Derived[] = [];
  if (contact.source !== "ais") return events;
  const latest = contact.latest;
  const sog = latest.speedOverGround;
  const course = latest.courseOverGround ?? latest.trueHeading;
  if (sog == null || course == null) return events;
  if (sog < THRESHOLDS.projectionMinSpeedKnots) return events;

  const enrichment = getEnrichment(contact);
  const flag = flagFromMmsi(contact.mmsi);
  const risky = Boolean(
    enrichment?.sanctionsMatch || enrichment?.insurance === "utløpt" || flag?.risky
  );
  const slow = sog <= THRESHOLDS.slowApproachMaxKnots;
  if (!risky && !slow) return events;

  for (const corridor of CORRIDORS) {
    if (inPoly(latest, corridor)) continue; // already there — cable-loiter's job

    // Walk the projection until it enters the corridor
    let tteMin: number | null = null;
    for (
      let t = THRESHOLDS.projectionStepMinutes;
      t <= THRESHOLDS.projectionHorizonMinutes;
      t += THRESHOLDS.projectionStepMinutes
    ) {
      const pos = projectPosition(
        latest.longitude,
        latest.latitude,
        course,
        (sog * t) / 60
      );
      if (pointInPolygon(pos, corridor.polygon)) {
        tteMin = t;
        break;
      }
    }
    if (tteMin == null) continue;

    const extra: ScoreFactor[] = [];
    if (slow) {
      extra.push({
        id: "slow-approach",
        label: "Lav fart mot korridor",
        points: SCORING.factors.slowApproach,
      });
    }
    if (tteMin <= THRESHOLDS.approachImminentMinutes) {
      extra.push({
        id: "imminent",
        label: `Beregnet ankomst < ${THRESHOLDS.approachImminentMinutes} min`,
        points: SCORING.factors.imminentApproach,
      });
    }
    events.push(
      makeEvent(
        // startedAt anchors to the report the projection is based on — stable
        // per report, honest about its basis
        { type: "infra-approach", contact, position: latest, startedAt: latest.msgtime, now, extra },
        corridor.id,
        latest.msgtime,
        `Med kurs ${Math.round(course)}° og ${sog.toFixed(1)} kn når kontakten ${corridor.name} om ~${tteMin} min (enkel kursfremskriving).`
      )
    );
  }
  return events;
}

function detectZoneEvents(contact: Contact, now: Date): Derived[] {
  const events: Derived[] = [];
  const track = contact.track;
  if (track.length === 0) return events;
  const latest = track[track.length - 1];

  for (const zone of ZONES) {
    if (!inPoly(latest, zone)) continue;

    // Walk back to find when the contact entered the zone in this track window
    let entryIndex = track.length - 1;
    for (let i = track.length - 2; i >= 0; i--) {
      if (!inPoly(track[i], zone)) break;
      entryIndex = i;
    }
    const enteredAt = track[entryIndex].msgtime;
    const wasOutsideBefore = entryIndex > 0;

    if (wasOutsideBefore) {
      events.push(
        makeEvent(
          { type: "zone-entry", contact, position: latest, startedAt: enteredAt, now },
          zone.id,
          latest.msgtime,
          `Gikk inn i ${zone.name} kl. ${fmtClock(enteredAt)} i ${fmtSpeed(
            latest.speedOverGround
          )}.`
        )
      );
    }

    // Generic loitering inside a monitoring zone
    const slowSince = findSlowInsideStart(track, zone);
    if (
      slowSince &&
      minutesBetween(slowSince, latest.msgtime) >= THRESHOLDS.loiterMinMinutes
    ) {
      const minutes = Math.round(minutesBetween(slowSince, latest.msgtime));
      const extra: ScoreFactor[] =
        minutes > 30
          ? [
              {
                id: "long-loiter",
                label: "Vedvarende i over 30 min",
                points: SCORING.factors.longLoiter,
              },
            ]
          : [];
      events.push(
        makeEvent(
          { type: "loitering", contact, position: latest, startedAt: slowSince, now, extra },
          zone.id,
          latest.msgtime,
          `Har ligget under ${THRESHOLDS.loiterMaxSpeedKnots} kn i ${zone.name} i ${minutes} min.`
        )
      );
    }
  }
  return events;
}

/** A contact from a non-AIS sensor with no AIS identity — the strongest dark-vessel signal. */
function detectDarkContact(contact: Contact, now: Date): Derived | null {
  if (contact.source === "ais") return null;
  const firstSeen = contact.track[0]?.msgtime ?? contact.latest.msgtime;
  return makeEvent(
    {
      type: "dark-contact",
      contact,
      position: contact.latest,
      startedAt: firstSeen,
      now,
    },
    null,
    contact.latest.msgtime,
    `${contact.sourceLabel} følger en kontakt uten AIS-identitet. Ingen fartøy i AIS-bildet svarer til sporet.`
  );
}

/* ------------------------------- Pipeline -------------------------------- */

/** Derive all active events for the current contact picture, highest score first. */
export function deriveEvents(contacts: Contact[], now: Date): Derived[] {
  const events: Derived[] = [];
  for (const contact of contacts) {
    const dark = detectDarkContact(contact, now);
    if (dark) events.push(dark);

    const gap = detectAisGap(contact, now);
    if (gap) {
      events.push(gap);
      // A dark vessel reports nothing new — zone/loiter states would be stale
      continue;
    }
    const jump = detectAisJump(contact, now);
    if (jump) events.push(jump);
    events.push(...detectInfraApproach(contact, now));
    events.push(...detectCableLoiter(contact, now));
    events.push(...detectZoneEvents(contact, now));
  }
  return events.sort((a, b) => b.score - a.score);
}
