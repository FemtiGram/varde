/**
 * Land/sea sampling against OSM raster tiles, where water is a single flat
 * colour — used as drawing reference; the sjøkart shows the same coastline.
 * ~20 tiles fetched once per run, cached in memory.
 */
import { PNG } from "pngjs";

const tileCache = new Map<string, PNG>();

async function getTile(z: number, x: number, y: number): Promise<PNG> {
  const key = `${z}/${x}/${y}`;
  const cached = tileCache.get(key);
  if (cached) return cached;
  const res = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, {
    headers: { "User-Agent": "varde-prototype-dev-check/1.0 (waypoint validation, ~20 tiles)" },
  });
  if (!res.ok) throw new Error(`tile ${key}: ${res.status}`);
  const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()));
  tileCache.set(key, png);
  return png;
}

export async function isWaterOsm(lon: number, lat: number, z?: number): Promise<boolean> {
  if (z == null) z = lat > 59.63 && lat < 59.72 ? 14 : 13;
  const n = 2 ** z;
  const xf = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yf = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const tileX = Math.floor(xf);
  const tileY = Math.floor(yf);
  const png = await getTile(z, tileX, tileY);
  const px = Math.floor((xf - tileX) * 256);
  const py = Math.floor((yf - tileY) * 256);
  const i = (py * png.width + px) * 4;
  const [r, g, b] = [png.data[i], png.data[i + 1], png.data[i + 2]];
  // OSM water: #aad3df (170,211,223); allow slack for labels/ferry-line antialiasing
  return Math.abs(r - 170) < 35 && Math.abs(g - 211) < 30 && Math.abs(b - 223) < 30;
}

/** Majority vote in a ~100 m neighbourhood so map labels/route lines don't flag as land. */
export async function isWaterOsmArea(lon: number, lat: number): Promise<boolean> {
  const offsets: [number, number][] = [
    [0, 0], [0.0009, 0], [-0.0009, 0], [0, 0.00045], [0, -0.00045],
  ];
  let water = 0;
  for (const [dLon, dLat] of offsets) {
    if (await isWaterOsm(lon + dLon, lat + dLat)) water++;
  }
  return water >= 3;
}
