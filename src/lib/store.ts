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
  selectedContactId: string | null;
  selectedEventId: string | null;
  /** Bumped whenever the map should fly to the selected contact (list/drawer driven) */
  focusNonce: number;
  /** Infrastructure layer (cable corridors) visibility */
  showInfrastructure: boolean;

  setMode: (mode: DataMode) => void;
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
  selectedContactId: null,
  selectedEventId: null,
  focusNonce: 0,
  showInfrastructure: true,

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
      selectedContactId: null,
      selectedEventId: null,
    }),

  ingestReports: (reports, nowMs, replace) => {
    const contacts = buildContacts(get().contacts, reports, nowMs, replace);
    const derived = deriveEvents(Object.values(contacts), new Date(nowMs));
    set({
      contacts,
      nowMs,
      events: mergeDecisions(derived, get().decisions),
    });
  },

  refresh: (nowMs) => {
    const derived = deriveEvents(Object.values(get().contacts), new Date(nowMs));
    set({ nowMs, events: mergeDecisions(derived, get().decisions) });
  },

  selectContact: (contactId) =>
    set((s) => ({
      selectedContactId: contactId,
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
    set({
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
