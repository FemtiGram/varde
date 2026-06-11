/**
 * Dev verification: replays the deterministic scenario at key clock points and
 * prints the derived, ranked event list — confirms the slice-2 story beats
 * without launching a browser. Run: npx tsx scripts/verify-scenario.ts
 */
import { deriveEvents } from "../src/lib/events";
import { registerEnrichment } from "../src/lib/risk";
import { SCENARIO_ENRICHMENT, scenarioReports } from "../src/lib/scenario";
import { sensorReports, SENSOR_SOURCE_LABEL } from "../src/lib/sensor-feed";
import { THRESHOLDS } from "../src/lib/config";
import type { Contact, PositionReport } from "../src/lib/types";

registerEnrichment(SCENARIO_ENRICHMENT);

const ANCHOR = Date.parse("2026-06-11T08:00:00Z");

function buildContacts(reports: PositionReport[]): Contact[] {
  const map = new Map<string, Contact>();
  for (const r of reports) {
    const prev = map.get(r.contactId);
    if (!prev) {
      map.set(r.contactId, {
        id: r.contactId,
        source: r.source,
        constructed: r.constructed,
        sourceLabel: r.source === "ais" ? "AIS" : SENSOR_SOURCE_LABEL,
        mmsi: r.mmsi,
        name: r.name,
        shipType: r.shipType,
        latest: r,
        track: [r],
      });
    } else {
      prev.track.push(r);
      prev.latest = r;
    }
  }
  return [...map.values()];
}

for (const tSec of [60, 400, 600, 1000, 1400, 1800, 2200]) {
  const nowMs = ANCHOR + tSec * 1000;
  const fromSec = tSec - THRESHOLDS.trackHistoryMinutes * 60;
  const reports = [
    ...scenarioReports(fromSec, tSec, ANCHOR),
    ...sensorReports(nowMs - THRESHOLDS.trackHistoryMinutes * 60_000, nowMs),
  ];
  const contacts = buildContacts(reports);
  const events = deriveEvents(contacts, new Date(nowMs));
  console.log(`\n=== t=+${tSec}s (${contacts.length} kontakter) ===`);
  for (const e of events) {
    console.log(
      `  [${String(e.score).padStart(3)}] ${e.severity.padEnd(8)} ${e.type.padEnd(13)} ${
        e.contactName ?? e.contactId
      }  — ${e.reason.slice(0, 90)}`
    );
  }
}
