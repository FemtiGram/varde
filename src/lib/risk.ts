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
const MID_FLAGS: Record<number, string> = {
  209: "Kypros",
  210: "Kypros",
  211: "Tyskland",
  212: "Kypros",
  215: "Malta",
  219: "Danmark",
  220: "Danmark",
  224: "Spania",
  226: "Frankrike",
  227: "Frankrike",
  228: "Frankrike",
  229: "Malta",
  230: "Finland",
  231: "Færøyene",
  232: "Storbritannia",
  233: "Storbritannia",
  234: "Storbritannia",
  235: "Storbritannia",
  244: "Nederland",
  245: "Nederland",
  246: "Nederland",
  248: "Malta",
  249: "Malta",
  255: "Portugal (Madeira)",
  256: "Malta",
  257: "Norge",
  258: "Norge",
  259: "Norge",
  265: "Sverige",
  266: "Sverige",
  273: "Russland",
  275: "Latvia",
  276: "Estland",
  277: "Litauen",
  304: "Antigua og Barbuda",
  305: "Antigua og Barbuda",
  311: "Bahamas",
  314: "Barbados",
  351: "Panama",
  352: "Panama",
  353: "Panama",
  354: "Panama",
  355: "Panama",
  370: "Panama",
  371: "Panama",
  372: "Panama",
  373: "Panama",
  457: "Mongolia",
  477: "Hongkong",
  511: "Palau",
  518: "Cookøyene",
  538: "Marshalløyene",
  563: "Singapore",
  564: "Singapore",
  566: "Singapore",
  613: "Kamerun",
  616: "Komorene",
  626: "Gabon",
  636: "Liberia",
  667: "Sierra Leone",
  677: "Tanzania",
};

export interface FlagInfo {
  mid: number;
  country: string | null;
  risky: boolean;
}

/** Flag state derived from the MMSI MID prefix — real, AIS-derivable data. */
export function flagFromMmsi(mmsi: number | null): FlagInfo | null {
  if (mmsi == null || mmsi < 100_000_000) return null;
  const mid = Math.floor(mmsi / 1_000_000);
  return {
    mid,
    country: MID_FLAGS[mid] ?? null,
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

export interface RiskProfile {
  level: RiskLevel;
  /** Operator-readable reasons behind the level (Norwegian) */
  reasons: string[];
  flag: FlagInfo | null;
  enrichment: VesselEnrichment | null;
}

export function riskProfile(contact: Contact): RiskProfile {
  const flag = flagFromMmsi(contact.mmsi);
  const enrichment = getEnrichment(contact);
  const reasons: string[] = [];
  let points = 0;

  if (contact.source !== "ais") {
    reasons.push("Kontakt uten AIS-identitet");
    points += 2;
  }
  if (flag?.risky) {
    reasons.push(`Flaggstat ${flag.country ?? flag.mid} (forenklet risikoliste)`);
    points += 1;
  }
  if (enrichment?.sanctionsMatch) {
    reasons.push("Treff i sanksjonsliste (illustrativ)");
    points += 2;
  }
  if (enrichment?.insurance === "utløpt") {
    reasons.push("Forsikring utløpt (illustrativ)");
    points += 1;
  }

  const level: RiskLevel = points >= 3 ? "høy" : points >= 1 ? "forhøyet" : "lav";
  return { level, reasons, flag, enrichment };
}
