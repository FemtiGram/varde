import type { PositionReport } from "./types";

/**
 * Illustrative non-AIS sensor source (slice 2, sensor-fusion readiness).
 *
 * One constructed "radar" contact with no AIS identity, drifting slowly near
 * corridor K2. It feeds the SAME ingest pipeline as BarentsWatch AIS data —
 * that is the architectural point: AIS is one source among several, and a
 * real radar/satellite/subsea layer could slot in here without a rewrite.
 *
 * The track is a deterministic slow loop, parameterised purely by the clock,
 * so it works identically in live mode (wall clock) and scenario mode
 * (replay clock).
 */

export const SENSOR_CONTACT_ID = "sensor:radar-01";
export const SENSOR_SOURCE_LABEL = "Radar (illustrativ)";

/** Loop geometry: a slow ellipse inside corridor K2 (water-verified, see scripts/check-water.ts) */
export const SENSOR_LOOP = {
  center: [10.636, 59.6135] as [number, number],
  radiusLon: 0.0035,
  radiusLat: 0.0015,
} as const;
/** Full loop period in (clock) seconds — ≈0.9 kn along the path */
const PERIOD_SEC = 2400;
const REPORT_EVERY_SEC = 60;

function positionAtMs(ms: number): {
  lon: number;
  lat: number;
  courseDeg: number;
  sogKnots: number;
} {
  const phase = ((ms / 1000) % PERIOD_SEC) / PERIOD_SEC;
  const a = phase * 2 * Math.PI;
  const { center, radiusLon, radiusLat } = SENSOR_LOOP;
  const lon = center[0] + radiusLon * Math.cos(a);
  const lat = center[1] + radiusLat * Math.sin(a);
  // Tangent of the ellipse gives course; speed is roughly constant on the loop
  const tangent = Math.atan2(
    radiusLat * Math.cos(a),
    -radiusLon * Math.sin(a) * Math.cos((center[1] * Math.PI) / 180)
  );
  const courseDeg = (90 - (tangent * 180) / Math.PI + 360) % 360;
  return { lon, lat, courseDeg, sogKnots: 0.9 };
}

/** Sensor reports on a fixed grid inside the given clock window (ms). */
export function sensorReports(fromMs: number, toMs: number): PositionReport[] {
  const out: PositionReport[] = [];
  const stepMs = REPORT_EVERY_SEC * 1000;
  const first = Math.ceil(fromMs / stepMs) * stepMs;
  for (let t = first; t <= toMs; t += stepMs) {
    const p = positionAtMs(t);
    out.push({
      contactId: SENSOR_CONTACT_ID,
      source: "sensor",
      constructed: true,
      mmsi: null,
      msgtime: new Date(t).toISOString(),
      longitude: p.lon,
      latitude: p.lat,
      speedOverGround: p.sogKnots,
      courseOverGround: Math.round(p.courseDeg * 10) / 10,
      trueHeading: null, // a radar sees movement, not heading
      name: null,
      shipType: null,
    });
  }
  return out;
}
