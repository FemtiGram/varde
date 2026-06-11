/** ASCII land/sea reference map of the operating bbox (OSM tiles, z12). */
import { isWaterOsm } from "./osm-sampler";

async function main() {
  const minLon = 10.3, maxLon = 10.78, minLat = 59.32, maxLat = 59.78;
  const dLon = 0.005, dLat = 0.0025;
  for (let lat = maxLat; lat >= minLat; lat -= dLat) {
    let row = "";
    for (let lon = minLon; lon <= maxLon + 1e-9; lon += dLon) {
      row += (await isWaterOsm(lon, lat)) ? "·" : "#";
    }
    const label = Math.abs((lat * 1000) % 20) < 0.1 ? lat.toFixed(2) : "     ";
    console.log(`${label} ${row}`);
  }
  let axis = "      ";
  const cols = Math.round((maxLon - minLon) / dLon) + 1;
  for (let i = 0; i < cols; i++) axis += i % 10 === 0 ? "|" : " ";
  console.log(axis);
  let axis2 = "      ";
  for (let lon = minLon; lon <= maxLon; lon += dLon * 10) axis2 += lon.toFixed(2).padEnd(10);
  console.log(axis2);
}
main();
