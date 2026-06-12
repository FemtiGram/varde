import { bearingDegrees, haversineMetres, lerpPosition } from "./geo";
import type { PositionReport, VesselEnrichment } from "./types";

/**
 * Scenario mode: a deterministic, recorded scene for demos when live data is
 * quiet or unavailable. Vessels follow scripted waypoint legs; positions,
 * speeds and courses are derived from the legs, so the data is self-consistent.
 *
 * All vessels, names, MMSI numbers and enrichment values here are CONSTRUCTED
 * for the demo and clearly labelled as such in the about note. Timestamps are
 * anchored to when scenario mode starts, replayed at scenarioSpeedup × real time.
 *
 * Story beats (scenario seconds; ~12× faster on the wall clock):
 *   t≈ -900  FALKVIK enters Sone A (zone entry already in the list at load)
 *   t≈    0  sensor contact without AIS active near corridor K2 (sensor-feed.ts)
 *   t≈ +300  FALKVIK has loitered ≥15 min in Sone A   → generic loitering
 *   t≈ +480  GRANHOLM enters Sone B northbound        → zone entry
 *   t≈ +900  VESTBRIS (Gabon flag, illustrative sanctions match) silent 10 min,
 *            last seen in Sone B                       → shadow-fleet AIS gap
 *   t≈+1200  KORSVIK jumps ~2 nm in 30 s               → AIS jump (spoofing)
 *   t≈+1200  GRÅHOLM slow inside corridor K1, dragging → cable-threat loiter
 *   t≈+1700  EIKHOLM enters Sone B                     → zone entry
 *   t≈+2600  SJØSPRINT enters Sone B at ~28 kn         → zone entry
 */

interface Leg {
  /** Scenario time in seconds (may be negative = before scenario start) */
  t: number;
  lon: number;
  lat: number;
}

export interface ScenarioVessel {
  mmsi: number;
  name: string;
  shipType: number;
  /** Seconds between AIS reports in the scenario (default 30) */
  reportEverySec?: number;
  /** Vessel stops transmitting at this scenario time ("goes dark") */
  silentFromSec?: number;
  legs: Leg[];
}

// All waypoints below are verified to lie on water (scripts/check-water.ts
// samples every leg against map tiles). Run that check after editing legs.
const HORTEN: [number, number] = [10.51, 59.4265];
const MOSS: [number, number] = [10.6495, 59.428];

export const SCENARIO_VESSELS: ScenarioVessel[] = [
  // Ferry Horten→Moss→Horten, passing south of Bastøy. The Bastø ferries
  // carry their REAL names: the depicted route is their actual daily route
  // and they trigger no events. Vessels tied to threat behaviour are always
  // fictional — real identities are never attached to constructed events.
  {
    mmsi: 257100101,
    name: "BASTØ ELECTRIC",
    shipType: 60,
    legs: [
      { t: -300, lon: HORTEN[0], lat: HORTEN[1] },
      { t: 600, lon: 10.6, lat: 59.411 },
      { t: 1100, lon: 10.638, lat: 59.416 },
      { t: 1300, lon: 10.648, lat: 59.424 },
      { t: 1500, lon: MOSS[0], lat: MOSS[1] },
      { t: 2100, lon: MOSS[0], lat: MOSS[1] },
      { t: 2300, lon: 10.648, lat: 59.424 },
      { t: 2500, lon: 10.638, lat: 59.416 },
      { t: 3000, lon: 10.6, lat: 59.411 },
      { t: 3900, lon: HORTEN[0], lat: HORTEN[1] },
    ],
  },
  // Ferry Moss→Horten, opposite phase
  {
    mmsi: 257100102,
    name: "BASTØ IV",
    shipType: 60,
    legs: [
      { t: -300, lon: MOSS[0], lat: MOSS[1] },
      { t: -100, lon: 10.648, lat: 59.424 },
      { t: 200, lon: 10.638, lat: 59.416 },
      { t: 800, lon: 10.6, lat: 59.411 },
      { t: 1500, lon: HORTEN[0], lat: HORTEN[1] },
      { t: 2100, lon: HORTEN[0], lat: HORTEN[1] },
      { t: 2800, lon: 10.6, lat: 59.411 },
      { t: 3300, lon: 10.638, lat: 59.416 },
      { t: 3600, lon: 10.648, lat: 59.424 },
      { t: 3900, lon: MOSS[0], lat: MOSS[1] },
    ],
  },
  // Workboat that slows to a stop inside Sone A → generic loitering
  {
    mmsi: 257200201,
    name: "FALKVIK",
    shipType: 33,
    legs: [
      { t: -1500, lon: 10.487, lat: 59.452 },
      { t: -600, lon: 10.503, lat: 59.462 },
      { t: 3600, lon: 10.508, lat: 59.466 },
    ],
  },
  // Cargo northbound in the fairway → zone entry in Drøbaksundet at t≈480
  {
    mmsi: 257300301,
    name: "GRANHOLM",
    shipType: 70,
    legs: [
      { t: -1800, lon: 10.59, lat: 59.497 },
      { t: -1300, lon: 10.605, lat: 59.52 },
      { t: -360, lon: 10.625, lat: 59.575 },
      { t: 480, lon: 10.622, lat: 59.632 },
      { t: 1020, lon: 10.613, lat: 59.664 },
      { t: 1240, lon: 10.613, lat: 59.677 },
      { t: 1320, lon: 10.614, lat: 59.68 },
      { t: 1430, lon: 10.609, lat: 59.6835 },
      { t: 1620, lon: 10.594, lat: 59.696 },
    ],
  },
  // Tanker, Gabon flag (constructed shadow-fleet profile), southbound in the
  // sound, goes dark inside Sone B → the shadow-fleet AIS-gap beat
  {
    mmsi: 626400401,
    name: "VESTBRIS",
    shipType: 80,
    silentFromSec: 300,
    legs: [
      { t: -560, lon: 10.594, lat: 59.696 },
      { t: -370, lon: 10.596, lat: 59.691 },
      { t: -200, lon: 10.606, lat: 59.684 },
      { t: 0, lon: 10.613, lat: 59.675 },
      { t: 600, lon: 10.614, lat: 59.66 },
    ],
  },
  // Tanker whose AIS track jumps ~2 nm in seconds → spoofing signature
  {
    mmsi: 257400403,
    name: "KORSVIK",
    shipType: 80,
    legs: [
      { t: -1200, lon: 10.59, lat: 59.395 },
      { t: 0, lon: 10.572, lat: 59.44 },
      { t: 1199, lon: 10.578, lat: 59.49 },
      { t: 1201, lon: 10.515, lat: 59.505 },
      { t: 2400, lon: 10.524, lat: 59.528 },
    ],
  },
  // Bulk carrier slowing to ~1.3 kn inside corridor K1, creeping along it —
  // the anchor-drag cable-threat beat
  {
    mmsi: 257300304,
    name: "GRÅHOLM",
    shipType: 70,
    legs: [
      { t: -1500, lon: 10.59, lat: 59.51 },
      { t: 0, lon: 10.608, lat: 59.548 },
      { t: 500, lon: 10.612, lat: 59.551 },
      { t: 2600, lon: 10.636, lat: 59.5535 },
      { t: 3300, lon: 10.638, lat: 59.525 },
    ],
  },
  // Second cargo northbound, ~20 min behind GRANHOLM (same fairway)
  {
    mmsi: 257300302,
    name: "EIKHOLM",
    shipType: 70,
    legs: [
      { t: -1140, lon: 10.578, lat: 59.47 },
      { t: -600, lon: 10.59, lat: 59.497 },
      { t: -100, lon: 10.605, lat: 59.52 },
      { t: 840, lon: 10.625, lat: 59.575 },
      { t: 1680, lon: 10.622, lat: 59.632 },
      { t: 2220, lon: 10.613, lat: 59.664 },
      { t: 2440, lon: 10.613, lat: 59.677 },
      { t: 2520, lon: 10.614, lat: 59.68 },
      { t: 2630, lon: 10.609, lat: 59.6835 },
      { t: 2820, lon: 10.594, lat: 59.696 },
    ],
  },
  // Fast passenger craft northbound late in the scenario (~30 kn, slows in the narrows)
  {
    mmsi: 257500501,
    name: "SJØSPRINT",
    shipType: 40,
    legs: [
      { t: 600, lon: 10.56, lat: 59.355 },
      { t: 1250, lon: 10.572, lat: 59.445 },
      { t: 1730, lon: 10.6, lat: 59.51 },
      { t: 1840, lon: 10.612, lat: 59.525 },
      { t: 2060, lon: 10.62, lat: 59.555 },
      { t: 2640, lon: 10.622, lat: 59.635 },
      { t: 2990, lon: 10.613, lat: 59.664 },
      { t: 3130, lon: 10.613, lat: 59.677 },
      { t: 3180, lon: 10.614, lat: 59.68 },
      { t: 3250, lon: 10.609, lat: 59.6835 },
      { t: 3360, lon: 10.594, lat: 59.696 },
    ],
  },
  // Cargo southbound, steady transit (background traffic)
  {
    mmsi: 257300303,
    name: "BJØRKHAV",
    shipType: 70,
    legs: [
      { t: -600, lon: 10.636, lat: 59.601 },
      { t: 425, lon: 10.615, lat: 59.55 },
      { t: 1435, lon: 10.59, lat: 59.5 },
      { t: 3600, lon: 10.575, lat: 59.39 },
    ],
  },
  // Tanker at anchor south in the fjord (stationary marker)
  {
    mmsi: 257400402,
    name: "TINDRA",
    shipType: 80,
    legs: [
      { t: -3600, lon: 10.5, lat: 59.382 },
      { t: 3600, lon: 10.501, lat: 59.383 },
    ],
  },
  // Fishing vessel working slowly mid-fjord, outside zones and corridors
  {
    mmsi: 257200202,
    name: "RYGGEFJELL",
    shipType: 30,
    legs: [
      { t: -1800, lon: 10.545, lat: 59.455 },
      { t: 0, lon: 10.568, lat: 59.465 },
      { t: 1800, lon: 10.558, lat: 59.483 },
      { t: 3600, lon: 10.535, lat: 59.465 },
    ],
  },
];

/**
 * Illustrative enrichment for constructed vessels, keyed by contact id.
 * These values are invented for the demo — risk.ts refuses to serve
 * enrichment for real (non-constructed) vessels.
 */
export const SCENARIO_ENRICHMENT: Record<string, VesselEnrichment> = {
  "ais:626400401": { builtYear: 2003, insurance: "utløpt", sanctionsMatch: true }, // VESTBRIS
  "ais:257400403": { builtYear: 2008, insurance: "ukjent", sanctionsMatch: false }, // KORSVIK
  "ais:257300304": { builtYear: 2006, insurance: "i-orden", sanctionsMatch: false }, // GRÅHOLM
  "ais:257100101": { builtYear: 2021, insurance: "i-orden", sanctionsMatch: false },
  "ais:257100102": { builtYear: 2017, insurance: "i-orden", sanctionsMatch: false },
  "ais:257200201": { builtYear: 1998, insurance: "i-orden", sanctionsMatch: false }, // FALKVIK
  "ais:257300301": { builtYear: 2011, insurance: "i-orden", sanctionsMatch: false },
  "ais:257300302": { builtYear: 2014, insurance: "i-orden", sanctionsMatch: false },
  "ais:257300303": { builtYear: 2009, insurance: "i-orden", sanctionsMatch: false },
  "ais:257400402": { builtYear: 2012, insurance: "i-orden", sanctionsMatch: false },
  "ais:257500501": { builtYear: 2019, insurance: "i-orden", sanctionsMatch: false },
  "ais:257200202": { builtYear: 2001, insurance: "i-orden", sanctionsMatch: false },
};

const DEFAULT_REPORT_EVERY = 30;

/** Interpolated position at scenario time t, or null if the vessel is not in the scene. */
function positionAt(v: ScenarioVessel, t: number): [number, number] | null {
  const legs = v.legs;
  if (t < legs[0].t || t > legs[legs.length - 1].t) return null;
  for (let i = 0; i < legs.length - 1; i++) {
    const a = legs[i];
    const b = legs[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t;
      const f = span === 0 ? 0 : (t - a.t) / span;
      return lerpPosition([a.lon, a.lat], [b.lon, b.lat], f);
    }
  }
  return null;
}

/** Build the AIS report at scenario time t (speed/course from local movement). */
function reportAt(
  v: ScenarioVessel,
  t: number,
  anchorMs: number
): PositionReport | null {
  const pos = positionAt(v, t);
  if (!pos) return null;
  // Derive SOG/COG from a short window around t so they match the track
  const dtSec = 60;
  const before = positionAt(v, t - dtSec) ?? pos;
  const after = positionAt(v, t + dtSec) ?? pos;
  const metres = haversineMetres(before, after);
  const sogKnots = metres / ((2 * dtSec) / 3600) / 1852;
  const moving = metres > 5;
  const course = moving ? bearingDegrees(before, after) : null;
  return {
    contactId: `ais:${v.mmsi}`,
    source: "ais",
    constructed: true,
    mmsi: v.mmsi,
    msgtime: new Date(anchorMs + t * 1000).toISOString(),
    longitude: pos[0],
    latitude: pos[1],
    speedOverGround: Math.round(sogKnots * 10) / 10,
    courseOverGround: course != null ? Math.round(course * 10) / 10 : null,
    trueHeading: course != null ? Math.round(course) : null,
    name: v.name,
    shipType: v.shipType,
  };
}

/**
 * All AIS reports in the scenario window (fromSec, toSec], on each vessel's
 * report grid. Used to (re)build tracks deterministically for any clock value.
 */
export function scenarioReports(
  fromSec: number,
  toSec: number,
  anchorMs: number
): PositionReport[] {
  const out: PositionReport[] = [];
  for (const v of SCENARIO_VESSELS) {
    const every = v.reportEverySec ?? DEFAULT_REPORT_EVERY;
    const silentFrom = v.silentFromSec ?? Infinity;
    const firstTick = Math.ceil(fromSec / every) * every;
    for (let t = firstTick; t <= toSec; t += every) {
      if (t >= silentFrom) break;
      const report = reportAt(v, t, anchorMs);
      if (report) out.push(report);
    }
  }
  return out;
}
