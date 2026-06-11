/** AIS ship type codes (ITU-R M.1371) mapped to Norwegian operator labels. */

export type ShipCategory =
  | "passasjer"
  | "last"
  | "tank"
  | "fiske"
  | "taubåt"
  | "hurtiggående"
  | "fritid"
  | "annet";

export function shipCategory(shipType: number | null): ShipCategory {
  if (shipType == null) return "annet";
  if (shipType === 30) return "fiske";
  if (shipType === 31 || shipType === 32 || shipType === 52) return "taubåt";
  if (shipType === 36 || shipType === 37) return "fritid";
  if (shipType >= 40 && shipType <= 49) return "hurtiggående";
  if (shipType >= 60 && shipType <= 69) return "passasjer";
  if (shipType >= 70 && shipType <= 79) return "last";
  if (shipType >= 80 && shipType <= 89) return "tank";
  return "annet";
}

const CATEGORY_LABELS: Record<ShipCategory, string> = {
  passasjer: "Passasjer",
  last: "Lasteskip",
  tank: "Tankskip",
  fiske: "Fiskefartøy",
  taubåt: "Taubåt/spesial",
  hurtiggående: "Hurtiggående",
  fritid: "Fritidsfartøy",
  annet: "Annet/ukjent",
};

export function shipTypeLabel(shipType: number | null): string {
  return CATEGORY_LABELS[shipCategory(shipType)];
}

/** Plausible max speed (knots) per category — used by AIS-jump detection. */
const MAX_PLAUSIBLE_KNOTS: Record<ShipCategory, number> = {
  passasjer: 30,
  last: 25,
  tank: 20,
  fiske: 15,
  taubåt: 16,
  hurtiggående: 45,
  fritid: 40,
  annet: 30,
};

export function maxPlausibleSpeed(shipType: number | null): number {
  return MAX_PLAUSIBLE_KNOTS[shipCategory(shipType)];
}
