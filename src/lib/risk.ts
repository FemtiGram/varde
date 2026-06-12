import { RISKY_FLAG_MIDS } from "./config";
import type { Contact, VesselEnrichment } from "./types";

/**
 * Vessel risk profile.
 *
 * Honesty boundary, enforced here:
 *  - Flag state IS derivable from the MMSI (the MID prefix). Treated as real.
 *  - Enrichment (built year, insurance, sanctions) is NOT in AIS and has no
 *    open feed in this prototype. It exists only for CONSTRUCTED demo vessels
 *    (registered in scenario data) and is always labelled illustrative.
 *    For real vessels these fields render as "not available" — never invented.
 */

/** MID → flag state (subset relevant to Norwegian waters + common registries). */
const MID_FLAGS: Record<number, { name: string; iso: string }> = {
  209: { name: "Kypros", iso: "cy" },
  210: { name: "Kypros", iso: "cy" },
  211: { name: "Tyskland", iso: "de" },
  212: { name: "Kypros", iso: "cy" },
  215: { name: "Malta", iso: "mt" },
  219: { name: "Danmark", iso: "dk" },
  220: { name: "Danmark", iso: "dk" },
  224: { name: "Spania", iso: "es" },
  226: { name: "Frankrike", iso: "fr" },
  227: { name: "Frankrike", iso: "fr" },
  228: { name: "Frankrike", iso: "fr" },
  229: { name: "Malta", iso: "mt" },
  230: { name: "Finland", iso: "fi" },
  231: { name: "Færøyene", iso: "fo" },
  232: { name: "Storbritannia", iso: "gb" },
  233: { name: "Storbritannia", iso: "gb" },
  234: { name: "Storbritannia", iso: "gb" },
  235: { name: "Storbritannia", iso: "gb" },
  244: { name: "Nederland", iso: "nl" },
  245: { name: "Nederland", iso: "nl" },
  246: { name: "Nederland", iso: "nl" },
  248: { name: "Malta", iso: "mt" },
  249: { name: "Malta", iso: "mt" },
  255: { name: "Portugal (Madeira)", iso: "pt" },
  256: { name: "Malta", iso: "mt" },
  257: { name: "Norge", iso: "no" },
  258: { name: "Norge", iso: "no" },
  259: { name: "Norge", iso: "no" },
  265: { name: "Sverige", iso: "se" },
  266: { name: "Sverige", iso: "se" },
  273: { name: "Russland", iso: "ru" },
  275: { name: "Latvia", iso: "lv" },
  276: { name: "Estland", iso: "ee" },
  277: { name: "Litauen", iso: "lt" },
  304: { name: "Antigua og Barbuda", iso: "ag" },
  305: { name: "Antigua og Barbuda", iso: "ag" },
  311: { name: "Bahamas", iso: "bs" },
  314: { name: "Barbados", iso: "bb" },
  351: { name: "Panama", iso: "pa" },
  352: { name: "Panama", iso: "pa" },
  353: { name: "Panama", iso: "pa" },
  354: { name: "Panama", iso: "pa" },
  355: { name: "Panama", iso: "pa" },
  370: { name: "Panama", iso: "pa" },
  371: { name: "Panama", iso: "pa" },
  372: { name: "Panama", iso: "pa" },
  373: { name: "Panama", iso: "pa" },
  457: { name: "Mongolia", iso: "mn" },
  477: { name: "Hongkong", iso: "hk" },
  511: { name: "Palau", iso: "pw" },
  518: { name: "Cookøyene", iso: "ck" },
  538: { name: "Marshalløyene", iso: "mh" },
  563: { name: "Singapore", iso: "sg" },
  564: { name: "Singapore", iso: "sg" },
  566: { name: "Singapore", iso: "sg" },
  613: { name: "Kamerun", iso: "cm" },
  616: { name: "Komorene", iso: "km" },
  626: { name: "Gabon", iso: "ga" },
  636: { name: "Liberia", iso: "lr" },
  667: { name: "Sierra Leone", iso: "sl" },
  677: { name: "Tanzania", iso: "tz" },
};

export interface FlagInfo {
  mid: number;
  country: string | null;
  /** ISO 3166-1 alpha-2 — drives the flag icon */
  iso: string | null;
  risky: boolean;
}

/** Flag state derived from the MMSI MID prefix — real, AIS-derivable data. */
export function flagFromMmsi(mmsi: number | null): FlagInfo | null {
  if (mmsi == null || mmsi < 100_000_000) return null;
  const mid = Math.floor(mmsi / 1_000_000);
  const entry = MID_FLAGS[mid];
  return {
    mid,
    country: entry?.name ?? null,
    iso: entry?.iso ?? null,
    risky: RISKY_FLAG_MIDS.has(mid),
  };
}

/** Enrichment registry for constructed demo vessels, keyed by contact id. */
let enrichmentRegistry: Record<string, VesselEnrichment> = {};

export function registerEnrichment(reg: Record<string, VesselEnrichment>) {
  enrichmentRegistry = reg;
}

/** Illustrative enrichment — only for constructed contacts, by design. */
export function getEnrichment(contact: Contact): VesselEnrichment | null {
  if (!contact.constructed) return null;
  return enrichmentRegistry[contact.id] ?? null;
}

export type RiskLevel = "lav" | "forhøyet" | "høy";

export type RiskReasonId = "no-ais" | "flag" | "sanctions" | "insurance";

export interface RiskReason {
  id: RiskReasonId;
  label: string;
}

export interface RiskProfile {
  level: RiskLevel;
  /** Operator-readable reasons behind the level (Norwegian) */
  reasons: RiskReason[];
  flag: FlagInfo | null;
  enrichment: VesselEnrichment | null;
}

export function riskProfile(contact: Contact): RiskProfile {
  const flag = flagFromMmsi(contact.mmsi);
  const enrichment = getEnrichment(contact);
  const reasons: RiskReason[] = [];
  let points = 0;

  if (contact.source !== "ais") {
    reasons.push({ id: "no-ais", label: "Kontakt uten AIS-identitet" });
    points += 2;
  }
  if (flag?.risky) {
    reasons.push({
      id: "flag",
      label: `Flaggstat ${flag.country ?? flag.mid} (forenklet risikoliste)`,
    });
    points += 1;
  }
  if (enrichment?.sanctionsMatch) {
    reasons.push({ id: "sanctions", label: "Treff i sanksjonsliste (illustrativ)" });
    points += 2;
  }
  if (enrichment?.insurance === "utløpt") {
    reasons.push({ id: "insurance", label: "Forsikring utløpt (illustrativ)" });
    points += 1;
  }

  const level: RiskLevel = points >= 3 ? "høy" : points >= 1 ? "forhøyet" : "lav";
  return { level, reasons, flag, enrichment };
}
