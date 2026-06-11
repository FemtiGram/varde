import { NextResponse } from "next/server";
import { getLatestPositions, hasCredentials } from "@/server/barentswatch";

export const dynamic = "force-dynamic";

/**
 * GET /api/ais — latest AIS positions inside the configured bounding box.
 * The browser polls this; the server caches upstream responses (see barentswatch.ts).
 */
export async function GET() {
  if (!hasCredentials()) {
    return NextResponse.json(
      {
        error: "missing-credentials",
        message:
          "BARENTSWATCH_CLIENT_ID / BARENTSWATCH_CLIENT_SECRET er ikke satt. Bruk scenariomodus, eller registrer en klient på barentswatch.no.",
      },
      { status: 503 }
    );
  }
  try {
    const positions = await getLatestPositions();
    return NextResponse.json({ positions, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("AIS proxy error:", err);
    return NextResponse.json(
      { error: "upstream-failed", message: "Klarte ikke å hente AIS-data fra BarentsWatch." },
      { status: 502 }
    );
  }
}
