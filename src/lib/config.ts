import type { InfrastructureCorridor, MonitoringZone } from "./types";

/**
 * All tunable parameters live here so they are easy to explain and adjust.
 * Coordinates are [lon, lat] (GeoJSON order).
 */

/** Operating area: Horten / inner Oslofjord, up through Drøbaksundet. */
export const BBOX = {
  minLon: 10.3,
  minLat: 59.32,
  maxLon: 10.78,
  maxLat: 59.78,
} as const;

export const MAP_CENTER: [number, number] = [10.55, 59.52];
export const MAP_DEFAULT_ZOOM = 10.5;

/**
 * Monitoring zones are drawn for this prototype (illustrative — not official
 * restricted areas). The geometry is the operator's geofence.
 */
export const ZONES: MonitoringZone[] = [
  {
    id: "sone-a",
    name: "Sone A · Vealøs",
    polygon: [
      [10.47, 59.445],
      [10.53, 59.445],
      [10.535, 59.478],
      [10.475, 59.478],
    ],
  },
  {
    id: "sone-b",
    name: "Sone B · Drøbaksundet",
    // Slanted to follow the channel, which bends west going north
    polygon: [
      [10.585, 59.63],
      [10.65, 59.63],
      [10.62, 59.7],
      [10.575, 59.7],
    ],
  },
];

/**
 * Critical-infrastructure corridors. REPRESENTATIVE geometry drawn for the
 * prototype: exact subsea cable routes are deliberately not fully public,
 * which is itself part of the operational reality.
 */
export const CORRIDORS: InfrastructureCorridor[] = [
  {
    id: "k1",
    name: "K1 · Kabelkorridor (illustrativ)",
    kind: "kabel",
    // Crosses the fjord shore to shore (cables land ashore at both ends)
    polygon: [
      [10.555, 59.542],
      [10.67, 59.549],
      [10.67, 59.563],
      [10.555, 59.556],
    ],
  },
  {
    id: "k2",
    name: "K2 · Kabelkorridor (illustrativ)",
    kind: "kabel",
    polygon: [
      [10.6, 59.602],
      [10.67, 59.608],
      [10.67, 59.622],
      [10.6, 59.616],
    ],
  },
];

export const THRESHOLDS = {
  /** Minutes without a position report before a contact is considered "dark" */
  aisGapMinutes: 10,
  /** A gap is dropped from the list after this long without contact (stale) */
  aisGapExpireMinutes: 120,
  /** AIS jump: implied speed (knots) above the plausible max for the ship type ... */
  jumpSpeedFactor: 1.6,
  /** ... and the jump must be at least this long (metres) to rule out GPS noise */
  jumpMinMetres: 1500,
  /** Loitering: below this speed (knots) ... */
  loiterMaxSpeedKnots: 1.5,
  /** ... for at least this long (minutes), inside a monitored zone */
  loiterMinMinutes: 15,
  /** Cable-threat loiter inside a corridor triggers faster than a generic loiter */
  cableLoiterMinMinutes: 10,
  /** Contacts slower than this are drawn as stationary (diamond) markers */
  stationaryMaxSpeedKnots: 0.5,
  /** How much recent track to keep per contact (minutes) */
  trackHistoryMinutes: 90,
  /** Live polling interval against our own proxy (ms) */
  livePollMs: 15_000,
  /** Server-side cache TTL for the BarentsWatch response (ms) */
  serverCacheMs: 20_000,
  /** Scenario replay speed multiplier (scenario seconds per wall-clock second) */
  scenarioSpeedup: 12,
} as const;

/**
 * Explainable priority scoring. An event's score is the SUM of explicit
 * factors; every factor is shown to the operator. No black box.
 */
export const SCORING = {
  /** Base points per event type — how serious is the pattern in itself */
  base: {
    "dark-contact": 60,
    "cable-loiter": 55,
    "ais-jump": 45,
    "ais-gap": 40,
    "zone-entry": 30,
    loitering: 30,
  },
  factors: {
    /** Position inside / last seen inside a cable corridor */
    nearInfrastructure: 25,
    /** Position inside a monitoring zone */
    inZone: 10,
    /** Vessel risk profile (illustrative enrichment, constructed vessels only) */
    sanctionsMatch: 25,
    riskyFlag: 10,
    insuranceLapsed: 10,
    /** Behaviour aggravators */
    longGap: 10, // gap > 30 min
    extremeJump: 10, // implied speed > 2× plausible max
    longLoiter: 10, // loitering > 30 min
    /** Contact detected by a non-AIS sensor with no AIS identity */
    nonAisSource: 20,
  },
  /** Fresh events get up to `recencyMax` extra points, decaying linearly */
  recencyMax: 15,
  recencyWindowMinutes: 30,
  /** Severity is derived from the total score */
  severity: {
    critical: 85,
    warning: 55,
  },
} as const;

/**
 * Flag states frequently associated with shadow-fleet registrations (MID
 * prefixes). The flag itself is real, derived from MMSI; treating these as
 * "risky" is a deliberate, illustrative simplification — stated in the about
 * note. Real systems would use curated intelligence.
 */
export const RISKY_FLAG_MIDS = new Set([
  457, // Mongolia
  511, // Palau
  518, // Cook Islands
  613, // Cameroon
  616, // Comoros
  626, // Gabon
  667, // Sierra Leone
  677, // Tanzania
]);
