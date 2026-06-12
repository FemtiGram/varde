import { create } from "zustand";
import { THRESHOLDS } from "./config";
import { deriveEvents } from "./events";
import { registerEnrichment } from "./risk";
import { SCENARIO_ENRICHMENT } from "./scenario";
import { SENSOR_SOURCE_LABEL } from "./sensor-feed";
import type {
  Contact,
  DataMode,
  EventDecision,
  JournalEntry,
  OperatorEvent,
  PositionReport,
} from "./types";

export type LiveStatus = "connecting" | "ok" | "no-credentials" | "error";

// Illustrative enrichment exists only for constructed scenario vessels
registerEnrichment(SCENARIO_ENRICHMENT);

interface DecisionRecord {
  decision: EventDecision;
  decidedAt: string;
}

interface AppState {
  mode: DataMode;
  liveStatus: LiveStatus;
  /** Wall-clock ms when scenario mode was (re)started */
  scenarioAnchorMs: number | null;
  /** The operational clock (ms since epoch) — wall time in live, replay time in scenario */
  nowMs: number;
  /** All tracked contacts (any source), keyed by contact id */
  contacts: Record<string, Contact>;
  events: OperatorEvent[];
  decisions: Record<string, DecisionRecord>;
  /** Operator journal (vaktjournal): every decision and undo, timestamped */
  journal: JournalEntry[];
  /** Last time each decided event id was seen in derivation — drives retention */
  decisionLastSeen: Record<string, number>;
  /** Events the operator has looked at or decided — unseen criticals blink (ATC alarm discipline) */
  seenEvents: Record<string, true>;
  selectedContactId: string | null;
  selectedEventId: string | null;
  /** Bumped whenever the map should fly to the selected contact (list/drawer driven) */
  focusNonce: number;
  /** Infrastructure layer (cable corridors) visibility */
  showInfrastructure: boolean;
  /** Active workspace view: map, decision board or the operator journal */
  view: "map" | "board" | "journal";
  /** Operator-adjustable height of the contact bottom sheet (px) */
  sheetHeight: number;
  /** Greyscale basemap — desaturated chart so vessels and overlays pop */
  mapGreyscale: boolean;
  /** EBL/VRM measure mode: click origin, read bearing/range to cursor */
  measuring: boolean;

  setMode: (mode: DataMode) => void;
  setView: (view: "map" | "board" | "journal") => void;
  setSheetHeight: (px: number) => void;
  setMapGreyscale: (on: boolean) => void;
  setMeasuring: (on: boolean) => void;
  setLiveStatus: (status: LiveStatus) => void;
  setShowInfrastructure: (show: boolean) => void;
  restartScenario: () => void;
  /** Merge/replace position reports (any source) and re-derive events against the given clock */
  ingestReports: (reports: PositionReport[], nowMs: number, replace: boolean) => void;
  /** Re-derive events without new data (gap conditions age over time) */
  refresh: (nowMs: number) => void;
  selectContact: (contactId: string | null) => void;
  selectEvent: (eventId: string | null) => void;
  /** Fly the map to a contact (used by the event list and the drawer) */
  focusContact: (contactId: string) => void;
  decide: (eventId: string, decision: EventDecision) => void;
}

function sourceLabelFor(report: PositionReport): string {
  return report.source === "ais" ? "AIS" : SENSOR_SOURCE_LABEL;
}

function buildContacts(
  existing: Record<string, Contact>,
  reports: PositionReport[],
  nowMs: number,
  replace: boolean
): Record<string, Contact> {
  const contacts: Record<string, Contact> = replace ? {} : { ...existing };
  for (const report of reports) {
    const prev = contacts[report.contactId];
    if (!prev) {
      contacts[report.contactId] = {
        id: report.contactId,
        source: report.source,
        constructed: report.constructed,
        sourceLabel: sourceLabelFor(report),
        mmsi: report.mmsi,
        name: report.name,
        shipType: report.shipType,
        latest: report,
        track: [report],
      };
      continue;
    }
    if (prev.latest.msgtime === report.msgtime) continue;
    contacts[report.contactId] = {
      ...prev,
      name: report.name ?? prev.name,
      shipType: report.shipType ?? prev.shipType,
      latest: report,
      track: [...prev.track, report],
    };
  }
  // Trim history and drop contacts not heard from in a long time
  const minTrackMs = nowMs - THRESHOLDS.trackHistoryMinutes * 60_000;
  const expireMs = nowMs - THRESHOLDS.aisGapExpireMinutes * 60_000;
  for (const id of Object.keys(contacts)) {
    const c = contacts[id];
    if (new Date(c.latest.msgtime).getTime() < expireMs) {
      delete contacts[id];
      continue;
    }
    const track = c.track.filter(
      (p) => new Date(p.msgtime).getTime() >= minTrackMs
    );
    contacts[id] = { ...c, track: track.length > 0 ? track : [c.latest] };
  }
  return contacts;
}

/**
 * Keep decisions for active events; decisions whose event has not been derived
 * for decisionRetentionMinutes are pruned (the journal keeps the record).
 */
function pruneDecisions(
  decisions: Record<string, DecisionRecord>,
  lastSeen: Record<string, number>,
  derived: { id: string }[],
  nowMs: number
): { decisions: Record<string, DecisionRecord>; lastSeen: Record<string, number> } {
  const derivedIds = new Set(derived.map((d) => d.id));
  const nextSeen: Record<string, number> = {};
  const nextDecisions: Record<string, DecisionRecord> = {};
  const retentionMs = THRESHOLDS.decisionRetentionMinutes * 60_000;
  for (const id of Object.keys(decisions)) {
    const seen = derivedIds.has(id) ? nowMs : (lastSeen[id] ?? nowMs);
    if (nowMs - seen <= retentionMs) {
      nextDecisions[id] = decisions[id];
      nextSeen[id] = seen;
    }
  }
  return { decisions: nextDecisions, lastSeen: nextSeen };
}

function mergeDecisions(
  derived: ReturnType<typeof deriveEvents>,
  decisions: Record<string, DecisionRecord>
): OperatorEvent[] {
  return derived.map((d) => {
    const rec = decisions[d.id];
    return {
      ...d,
      decision: rec?.decision ?? "none",
      decidedAt: rec?.decidedAt ?? null,
    };
  });
}

export const useAppStore = create<AppState>((set, get) => ({
  mode: "live",
  liveStatus: "connecting",
  scenarioAnchorMs: null,
  nowMs: Date.now(),
  contacts: {},
  events: [],
  decisions: {},
  journal: [],
  decisionLastSeen: {},
  seenEvents: {},
  selectedContactId: null,
  selectedEventId: null,
  focusNonce: 0,
  showInfrastructure: true,
  view: "map",
  sheetHeight: 360,
  mapGreyscale: true,
  measuring: false,

  setView: (view) => set({ view }),

  setSheetHeight: (px) =>
    set({ sheetHeight: Math.min(520, Math.max(220, Math.round(px))) }),

  setMapGreyscale: (mapGreyscale) => set({ mapGreyscale }),

  setMeasuring: (measuring) => set({ measuring }),

  setMode: (mode) => {
    if (mode === get().mode) return;
    set({
      mode,
      contacts: {},
      events: [],
      selectedContactId: null,
      selectedEventId: null,
      scenarioAnchorMs: mode === "scenario" ? Date.now() : null,
      nowMs: Date.now(),
    });
  },

  setLiveStatus: (liveStatus) => set({ liveStatus }),

  setShowInfrastructure: (showInfrastructure) => set({ showInfrastructure }),

  restartScenario: () =>
    set({
      scenarioAnchorMs: Date.now(),
      contacts: {},
      events: [],
      decisions: {},
      decisionLastSeen: {},
      seenEvents: {},
      selectedContactId: null,
      selectedEventId: null,
    }),

  ingestReports: (reports, nowMs, replace) => {
    const contacts = buildContacts(get().contacts, reports, nowMs, replace);
    const derived = deriveEvents(Object.values(contacts), new Date(nowMs));
    const pruned = pruneDecisions(
      get().decisions,
      get().decisionLastSeen,
      derived,
      nowMs
    );
    set({
      contacts,
      nowMs,
      decisions: pruned.decisions,
      decisionLastSeen: pruned.lastSeen,
      events: mergeDecisions(derived, pruned.decisions),
    });
  },

  refresh: (nowMs) => {
    const derived = deriveEvents(Object.values(get().contacts), new Date(nowMs));
    const pruned = pruneDecisions(
      get().decisions,
      get().decisionLastSeen,
      derived,
      nowMs
    );
    set({
      nowMs,
      decisions: pruned.decisions,
      decisionLastSeen: pruned.lastSeen,
      events: mergeDecisions(derived, pruned.decisions),
    });
  },

  selectContact: (contactId) =>
    set((s) => ({
      selectedContactId: contactId,
      seenEvents:
        contactId == null
          ? s.seenEvents
          : {
              ...s.seenEvents,
              ...Object.fromEntries(
                s.events
                  .filter((e) => e.contactId === contactId)
                  .map((e) => [e.id, true as const])
              ),
            },
      // Keep the selected event only if it belongs to the newly selected contact
      selectedEventId:
        contactId != null &&
        s.events.find((e) => e.id === s.selectedEventId)?.contactId === contactId
          ? s.selectedEventId
          : null,
    })),

  selectEvent: (eventId) => {
    if (eventId == null) {
      set({ selectedEventId: null });
      return;
    }
    const event = get().events.find((e) => e.id === eventId);
    set({
      selectedEventId: eventId,
      selectedContactId: event ? event.contactId : get().selectedContactId,
      focusNonce: get().focusNonce + 1,
      seenEvents: { ...get().seenEvents, [eventId]: true },
    });
  },

  focusContact: (contactId) =>
    set((s) => ({ selectedContactId: contactId, focusNonce: s.focusNonce + 1 })),

  decide: (eventId, decision) => {
    const decisions = { ...get().decisions };
    if (decision === "none") {
      delete decisions[eventId];
    } else {
      decisions[eventId] = { decision, decidedAt: new Date().toISOString() };
    }
    const event = get().events.find((e) => e.id === eventId);
    const entry: JournalEntry = {
      ts: new Date().toISOString(),
      eventId,
      contactName: event?.contactName ?? null,
      mmsi: event?.mmsi ?? null,
      eventType: event?.type ?? null,
      action: decision,
    };
    set({
      journal: [...get().journal, entry].slice(-500),
      seenEvents: { ...get().seenEvents, [eventId]: true },
      decisions,
      events: get().events.map((e) =>
        e.id === eventId
          ? {
              ...e,
              decision,
              decidedAt: decision === "none" ? null : decisions[eventId].decidedAt,
            }
          : e
      ),
    });
  },
}));

/** Scenario clock: wall time since anchor, sped up. */
export function scenarioNowMs(anchorMs: number, wallMs: number): number {
  return anchorMs + (wallMs - anchorMs) * THRESHOLDS.scenarioSpeedup;
}
