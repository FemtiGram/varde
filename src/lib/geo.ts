/** Geometry helpers. Coordinates are [lon, lat]. */

/** Ray-casting point-in-polygon. The ring does not need to be closed. */
export function pointInPolygon(
  point: [number, number],
  polygon: [number, number][]
): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Great-circle distance in metres. */
export function haversineMetres(
  a: [number, number],
  b: [number, number]
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Linear interpolation between two positions (good enough at fjord scale). */
export function lerpPosition(
  a: [number, number],
  b: [number, number],
  t: number
): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Initial bearing from a to b in degrees [0, 360). */
export function bearingDegrees(
  a: [number, number],
  b: [number, number]
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLon = toRad(b[0] - a[0]);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Format a coordinate pair as degrees + decimal minutes, the nautical convention. */
export function formatPosition(lat: number, lon: number): string {
  const fmt = (v: number, pos: string, neg: string) => {
    const hemi = v >= 0 ? pos : neg;
    const abs = Math.abs(v);
    const deg = Math.floor(abs);
    const min = (abs - deg) * 60;
    return `${deg}°${min.toFixed(2).padStart(5, "0")}'${hemi}`;
  };
  return `${fmt(lat, "N", "S")} ${fmt(lon, "E", "W")}`;
}

/** Dead-reckoning: project a position along a bearing (flat-earth approximation,
 * adequate at fjord scale and deliberately simple — stated in the about note). */
export function projectPosition(
  lon: number,
  lat: number,
  bearingDeg: number,
  distanceNm: number
): [number, number] {
  const rad = (bearingDeg * Math.PI) / 180;
  const dLat = (distanceNm * Math.cos(rad)) / 60;
  const dLon =
    (distanceNm * Math.sin(rad)) / (60 * Math.cos((lat * Math.PI) / 180));
  return [lon + dLon, lat + dLat];
}
