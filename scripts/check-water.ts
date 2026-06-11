/**
 * Regression check: every scenario track position and the sensor loop must be
 * on water. Samples each leg at the replay's report resolution against map
 * tiles (OSM raster — water is one flat colour; same coastline as the
 * sjøkart basemap). Majority-votes a ~100 m neighbourhood so map labels and
 * isolated chart pixels don't flag false positives.
 *
 * Run after editing scenario legs, zones or the sensor loop:
 *   npx tsx scripts/check-water.ts
 */
import { SCENARIO_VESSELS } from "../src/lib/scenario";
import { SENSOR_LOOP } from "../src/lib/sensor-feed";
import { isWaterOsm, isWaterOsmArea } from "./osm-sampler";

async function localMap(lon: number, lat: number) {
  for (let dy = 4; dy >= -4; dy--) {
    let row = "      ";
    for (let dx = -6; dx <= 6; dx++) {
      const here = dx === 0 && dy === 0;
      const water = await isWaterOsm(lon + dx * 0.004, lat + dy * 0.002);
      row += here ? "X" : water ? "·" : "#";
    }
    console.log(row);
  }
}

async function main() {
  let totalBad = 0;
  for (const v of SCENARIO_VESSELS) {
    const bad: { t: number; lon: number; lat: number }[] = [];
    for (let i = 0; i < v.legs.length - 1; i++) {
      const a = v.legs[i];
      const b = v.legs[i + 1];
      const steps = Math.max(1, Math.ceil(Math.abs(b.t - a.t) / 60));
      for (let s = 0; s <= steps; s++) {
        const f = s / steps;
        const lon = a.lon + (b.lon - a.lon) * f;
        const lat = a.lat + (b.lat - a.lat) * f;
        if (!(await isWaterOsmArea(lon, lat))) {
          bad.push({ t: Math.round(a.t + (b.t - a.t) * f), lon, lat });
        }
      }
    }
    if (bad.length === 0) {
      console.log(`✓ ${v.name}`);
    } else {
      totalBad += bad.length;
      console.log(`✗ ${v.name} — ${bad.length} punkter på land. Første:`);
      const p = bad[0];
      console.log(`  t=${p.t} (${p.lon.toFixed(4)}, ${p.lat.toFixed(4)})  [X=punktet, ·=vann, #=land]`);
      await localMap(p.lon, p.lat);
    }
  }
  // The illustrative sensor loop
  let sensorBad = 0;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * 2 * Math.PI;
    const lon = SENSOR_LOOP.center[0] + SENSOR_LOOP.radiusLon * Math.cos(a);
    const lat = SENSOR_LOOP.center[1] + SENSOR_LOOP.radiusLat * Math.sin(a);
    if (!(await isWaterOsmArea(lon, lat))) {
      sensorBad++;
      console.log(`✗ sensor-kontakt: (${lon.toFixed(4)}, ${lat.toFixed(4)}) på land`);
    }
  }
  if (sensorBad === 0) console.log("✓ sensor-kontakt (radar-01)");
  totalBad += sensorBad;
  console.log(totalBad === 0 ? "\nALT PÅ VANN ✓" : `\n${totalBad} punkter på land.`);
  if (totalBad > 0) process.exit(1);
}
main();
