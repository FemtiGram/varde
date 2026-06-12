/**
 * Rasterises the lighthouse favicon to a 32x32 PNG fallback (Safari et al.).
 * Run after changing src/app/icon.svg: npx tsx scripts/make-favicon.ts
 */
import { PNG } from "pngjs";
import { writeFileSync } from "fs";

const S = 32;
const png = new PNG({ width: S, height: S });

type RGBA = [number, number, number, number];
const BG: RGBA = [16, 21, 28, 255];
const BEAM: RGBA = [127, 214, 232, 128];
const LIGHT: RGBA = [174, 232, 245, 255];
const TOWER: RGBA = [232, 237, 243, 255];
const GROUND: RGBA = [57, 66, 79, 255];

function put(x: number, y: number, [r, g, b, a]: RGBA) {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const i = (y * S + x) * 4;
  const ao = a / 255;
  png.data[i] = Math.round(r * ao + png.data[i] * (1 - ao));
  png.data[i + 1] = Math.round(g * ao + png.data[i + 1] * (1 - ao));
  png.data[i + 2] = Math.round(b * ao + png.data[i + 2] * (1 - ao));
  png.data[i + 3] = 255;
}

function inTriangle(px: number, py: number, t: [number, number][]) {
  const [[ax, ay], [bx, by], [cx, cy]] = t;
  const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
  const u = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / d;
  const v = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / d;
  return u >= 0 && v >= 0 && u + v <= 1;
}

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    // rounded-square background
    const rx = Math.max(0, Math.max(7 - x, x - (S - 8)));
    const ry = Math.max(0, Math.max(7 - y, y - (S - 8)));
    if (rx * rx + ry * ry <= 49) put(x, y, BG);
  }
}
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const p: [number, number] = [x + 0.5, y + 0.5];
    if (
      inTriangle(p[0], p[1], [[13.2, 10.6], [2, 6.8], [2, 14.4]]) ||
      inTriangle(p[0], p[1], [[18.8, 10.6], [30, 6.8], [30, 14.4]])
    )
      put(x, y, BEAM);
    // tower (taper)
    const ty = p[1];
    if (ty >= 12.9 && ty <= 26) {
      const f = (ty - 12.9) / (26 - 12.9);
      const half = 2.1 + f * 1.7;
      if (Math.abs(p[0] - 16) <= half) {
        put(x, y, ty >= 17.6 && ty <= 19.8 ? BG : TOWER);
      }
    }
    // roof
    if (inTriangle(p[0], p[1], [[12.9, 8.2], [19.1, 8.2], [16, 5.4]])) put(x, y, TOWER);
    // lantern
    const dx = p[0] - 16;
    const dy = p[1] - 10.6;
    if (dx * dx + dy * dy <= 2.4 * 2.4) put(x, y, LIGHT);
    // ground
    if (ty >= 26 && ty <= 28.2 && p[0] >= 8.5 && p[0] <= 23.5) put(x, y, GROUND);
  }
}

writeFileSync("src/app/icon.png", PNG.sync.write(png));
console.log("src/app/icon.png skrevet (32x32)");
