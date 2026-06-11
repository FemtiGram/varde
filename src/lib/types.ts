/**
 * Source-agnostic track model (slice 2): AIS is ONE source among several.
 * Every position report carries its source and a contact id, so a radar,
 * satellite or subsea layer can feed the same pipeline without a rewrite.
 */

export type SourceType = "ais" | "sensor";

/** A single position report from any source. AIS fields are null when the source can't provide them. */
export interface PositionReport {
  /** Stable contact key across sources: "ais:<mmsi>" or "sensor:<sensorId>" */
  contactId: string;
  source: SourceType;
  /** True for constructed demo data (scenario vessels, the illustrative sensor track) */
  constructed: boolean;
  mmsi: number | null;
  /** ISO 8601 timestamp of the report */
  msgtime: string;
  latitude: number;
  longitude: number;
  /** Speed over ground in knots, null when not reported */
  speedOverGround: number | null;
  /** Course over ground in degrees, null when not reported */
  courseOverGround: number | null;
  /** True heading in degrees; null when not available */
  trueHeading: number | null;
  name: string | null;
  /** AIS ship type code (numeric), null when not reported / non-AIS source */
  shipType: number | null;
}

/** A tracked contact: latest report plus recent history from one source. */
export interface Contact {
  id: string;
  source: SourceType;
  constructed: boolean;
  /** Operator-facing source label, e.g. "AIS" or "Radar (illustrativ)" */
  sourceLabel: string;
  mmsi: number | null;
  name: string | null;
  shipType: number | null;
  latest: PositionReport;
  /** Recent positions, oldest first. Bounded by config.trackHistoryMinutes. */
  track: PositionReport[];
}

export type EventType =
  | "ais-gap"
  | "ais-jump"
  | "loitering"
  | "cable-loiter"
  | "zone-entry"
  | "dark-contact";

export type EventSeverity = "critical" | "warning" | "info";

export type EventDecision = "none" | "acknowledged" | "dismissed" | "escalated";

/** One explicit, operator-readable component of an event's priority score. */
export interface ScoreFactor {
  id: string;
  /** Norwegian label shown in the UI, e.g. "Sanksjonstreff (illustrativ)" */
  label: string;
  points: number;
}

export interface OperatorEvent {
  /** Stable id: `${type}:${contactId}:${zoneId|''}` so re-derivation updates rather than duplicates */
  id: string;
  type: EventType;
  /** Derived from the total score (thresholds in config) — threat level, not just event class */
  severity: EventSeverity;
  contactId: string;
  contactName: string | null;
  mmsi: number | null;
  /** Monitoring zone or infrastructure corridor involved, when relevant */
  zoneId: string | null;
  /** When the condition started (ISO 8601) */
  startedAt: string;
  /** Last time the condition was confirmed (ISO 8601) */
  updatedAt: string;
  /** One-line operator-facing explanation of why this matters (Norwegian) */
  reason: string;
  /** Total priority score — the sum of `factors` */
  score: number;
  /** The explainable breakdown behind `score` */
  factors: ScoreFactor[];
  /** Whether the underlying condition still holds */
  active: boolean;
  decision: EventDecision;
  decidedAt: string | null;
}

export interface MonitoringZone {
  id: string;
  name: string;
  /** Polygon ring, [lon, lat] pairs, first point repeated last not required */
  polygon: [number, number][];
}

/** A critical-infrastructure corridor (illustrative geometry). */
export interface InfrastructureCorridor {
  id: string;
  name: string;
  kind: "kabel";
  polygon: [number, number][];
}

/** Enrichment beyond AIS. Only ever attached to constructed demo vessels — never fabricated for real ones. */
export interface VesselEnrichment {
  builtYear: number;
  insurance: "i-orden" | "ukjent" | "utløpt";
  sanctionsMatch: boolean;
}

export type DataMode = "live" | "scenario";
