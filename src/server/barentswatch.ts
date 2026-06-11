import "server-only";

import { BBOX, THRESHOLDS } from "@/lib/config";
import type { PositionReport } from "@/lib/types";

/**
 * Thin server-side client for the BarentsWatch AIS API.
 * Credentials never leave the server; the browser only ever talks to /api/ais.
 *
 * Setup: register a client at https://www.barentswatch.no/minside/ and set
 *   BARENTSWATCH_CLIENT_ID, BARENTSWATCH_CLIENT_SECRET in .env.local
 * Docs: https://developer.barentswatch.no/docs/category/ais/
 */

const TOKEN_URL = "https://id.barentswatch.no/connect/token";
const LATEST_COMBINED_URL = "https://live.ais.barentswatch.no/v1/latest/combined";

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

interface ResponseCache {
  positions: PositionReport[];
  fetchedAt: number;
}

// Module-level caches survive between requests on a warm serverless instance /
// long-running dev server. Good enough for a single-scene prototype.
let tokenCache: TokenCache | null = null;
let responseCache: ResponseCache | null = null;
let inflight: Promise<PositionReport[]> | null = null;

export function hasCredentials(): boolean {
  return Boolean(
    process.env.BARENTSWATCH_CLIENT_ID && process.env.BARENTSWATCH_CLIENT_SECRET
  );
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 30_000) {
    return tokenCache.accessToken;
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.BARENTSWATCH_CLIENT_ID!,
      client_secret: process.env.BARENTSWATCH_CLIENT_SECRET!,
      scope: "ais",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`BarentsWatch token request failed: ${res.status}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return tokenCache.accessToken;
}

interface RawCombined {
  mmsi: number;
  msgtime: string;
  latitude: number;
  longitude: number;
  speedOverGround?: number | null;
  courseOverGround?: number | null;
  trueHeading?: number | null;
  name?: string | null;
  shipType?: number | null;
}

function inBbox(p: RawCombined): boolean {
  return (
    p.longitude >= BBOX.minLon &&
    p.longitude <= BBOX.maxLon &&
    p.latitude >= BBOX.minLat &&
    p.latitude <= BBOX.maxLat
  );
}

function toPositionReport(p: RawCombined): PositionReport {
  return {
    contactId: `ais:${p.mmsi}`,
    source: "ais",
    constructed: false,
    mmsi: p.mmsi,
    msgtime: p.msgtime,
    latitude: p.latitude,
    longitude: p.longitude,
    speedOverGround: p.speedOverGround ?? null,
    courseOverGround: p.courseOverGround ?? null,
    // 511 is the AIS sentinel for "heading not available"
    trueHeading: p.trueHeading === 511 ? null : (p.trueHeading ?? null),
    name: p.name ?? null,
    shipType: p.shipType ?? null,
  };
}

async function fetchLatestUncached(): Promise<PositionReport[]> {
  const token = await getAccessToken();
  const res = await fetch(LATEST_COMBINED_URL, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 401) {
    // Token may have been revoked early — drop it so the next call re-authenticates
    tokenCache = null;
    throw new Error("BarentsWatch rejected the access token (401)");
  }
  if (!res.ok) {
    throw new Error(`BarentsWatch AIS request failed: ${res.status}`);
  }
  const data = (await res.json()) as RawCombined[];
  return data.filter(inBbox).map(toPositionReport);
}

/**
 * Latest positions inside the configured bounding box, cached for
 * THRESHOLDS.serverCacheMs and deduplicated across concurrent callers
 * so the upstream is never hammered by map polling.
 */
export async function getLatestPositions(): Promise<PositionReport[]> {
  if (
    responseCache &&
    Date.now() - responseCache.fetchedAt < THRESHOLDS.serverCacheMs
  ) {
    return responseCache.positions;
  }
  if (!inflight) {
    inflight = fetchLatestUncached()
      .then((positions) => {
        responseCache = { positions, fetchedAt: Date.now() };
        return positions;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
