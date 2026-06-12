import type { EventSeverity, SourceType } from "@/lib/types";

/**
 * Contact marker glyph. Status is encoded by SHAPE first, colour second:
 *  - moving AIS vessel   → directional chevron (rotated to heading/course)
 *  - stationary AIS      → diamond (no meaningful heading)
 *  - non-AIS sensor      → solid circle with punched centre (unknown identity)
 *  - active event        → severity ring around the glyph (+ label on the map)
 *  - dark vessel (stale)  → hollow ghost outline at last known position (LKP)
 *  - selected            → designation reticle (corner brackets) + ping + glow
 * Colour vocabulary: green = normal traffic, red/amber/blue = severity,
 * cyan = selection, solid circle = unknown contact. The same in both
 * map modes, so the symbols stay learnable.
 * Produced as an SVG string so MapLibre DOM markers and React (design system)
 * share the exact same artwork.
 */

export interface VesselGlyphOptions {
  source?: SourceType;
  moving: boolean;
  headingDeg: number | null;
  severity: EventSeverity | null;
  selected: boolean;
  /** Last-known-position ghost: hollow outline for stale/dark contacts */
  ghost?: boolean;
  size?: number;
}

const SEVERITY_VARS: Record<EventSeverity, string> = {
  critical: "var(--status-critical)",
  warning: "var(--status-warning)",
  info: "var(--status-info)",
};

export function vesselGlyphSvg({
  source = "ais",
  moving,
  headingDeg,
  severity,
  selected,
  ghost = false,
  size = 26,
}: VesselGlyphOptions): string {
  // Normal traffic is green ("uneventful") so it stays visible on the
  // greyscale chart; severity colours take over when an event is active
  const fill = severity ? SEVERITY_VARS[severity] : "var(--contact-ais)";
  const rotation = moving && headingDeg != null ? headingDeg : 0;
  let shape: string;
  if (source !== "ais") {
    // Unknown contact: SOLID circle (full visual weight, like the vessel
    // glyphs) with a punched centre hole — the circle shape still says
    // "identity unconfirmed" where a chevron would read as an AIS vessel
    const discFill = severity ? SEVERITY_VARS[severity] : "var(--contact-unknown)";
    shape =
      `<circle cx="14" cy="14" r="8" fill="${discFill}" stroke="var(--background)" stroke-width="1.5" />` +
      `<circle cx="14" cy="14" r="2.4" fill="var(--background)" />`;
  } else if (moving) {
    shape = ghost
      ? `<path d="M14 3 L22 24 L14 19.5 L6 24 Z" fill="none" stroke="${fill}" stroke-width="2" stroke-linejoin="round" transform="rotate(${rotation} 14 14)" />`
      : `<path d="M14 3 L22 24 L14 19.5 L6 24 Z" fill="${fill}" stroke="var(--background)" stroke-width="1.5" stroke-linejoin="round" transform="rotate(${rotation} 14 14)" />`;
  } else {
    shape = ghost
      ? `<path d="M14 6.5 L21.5 14 L14 21.5 L6.5 14 Z" fill="none" stroke="${fill}" stroke-width="2" stroke-linejoin="round" />`
      : `<path d="M14 6.5 L21.5 14 L14 21.5 L6.5 14 Z" fill="${fill}" stroke="var(--background)" stroke-width="1.5" stroke-linejoin="round" />`;
  }
  const severityRing = severity
    ? `<circle cx="14" cy="14" r="11" fill="none" stroke="${SEVERITY_VARS[severity]}" stroke-width="1.5" stroke-dasharray="3 2.5" />`
    : "";
  // Selection: target-designation reticle — corner brackets clear of the
  // severity ring (distinct SHAPE, no radius collision), plus a faint halo
  const b = 2.2; // bracket inset from the viewBox edge
  const len = 6; // bracket arm length
  const bracketPaths =
    `<path d="M${b} ${b + len} V${b} H${b + len}" />` +
    `<path d="M${28 - b - len} ${b} H${28 - b} V${b + len}" />` +
    `<path d="M${28 - b} ${28 - b - len} V${28 - b} H${28 - b - len}" />` +
    `<path d="M${b + len} ${28 - b} H${b} V${28 - b - len}" />`;
  // Dark casing under the cyan strokes — same trick as the track line, so the
  // selection reads on the light chart without losing the brand cyan
  const selectionRing = selected
    ? `<circle cx="14" cy="14" r="13" fill="var(--selection-token)" fill-opacity="0.14" />` +
      `<g stroke="#10151c" stroke-width="4.4" fill="none" stroke-linecap="round" opacity="0.9">${bracketPaths}</g>` +
      `<g stroke="var(--selection-token)" stroke-width="2.4" fill="none" stroke-linecap="round">${bracketPaths}</g>`
    : "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 28 28" aria-hidden="true">${selectionRing}${severityRing}${shape}</svg>`;
}

/** React wrapper for the same glyph (used on the design-system page). */
export function VesselGlyph(props: VesselGlyphOptions) {
  return (
    <span
      className="inline-block leading-none"
      dangerouslySetInnerHTML={{ __html: vesselGlyphSvg(props) }}
    />
  );
}
