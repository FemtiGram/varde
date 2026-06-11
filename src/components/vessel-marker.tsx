import type { EventSeverity, SourceType } from "@/lib/types";

/**
 * Contact marker glyph. Status is encoded by SHAPE first, colour second:
 *  - moving AIS vessel   → directional chevron (rotated to heading/course)
 *  - stationary AIS      → diamond (no meaningful heading)
 *  - non-AIS sensor      → dashed hollow circle with centre dot (unknown identity)
 *  - active event        → severity ring around the glyph (+ label on the map)
 *  - selected            → outer selection ring
 * Produced as an SVG string so MapLibre DOM markers and React (design system)
 * share the exact same artwork.
 */

export interface VesselGlyphOptions {
  source?: SourceType;
  moving: boolean;
  headingDeg: number | null;
  severity: EventSeverity | null;
  selected: boolean;
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
  size = 26,
}: VesselGlyphOptions): string {
  const fill = severity ? SEVERITY_VARS[severity] : "var(--muted-foreground)";
  const rotation = moving && headingDeg != null ? headingDeg : 0;
  let shape: string;
  if (source !== "ais") {
    // Unknown contact: hollow dashed circle + centre dot — identity unconfirmed
    const stroke = severity ? SEVERITY_VARS[severity] : "var(--contact-unknown)";
    shape =
      `<circle cx="14" cy="14" r="7.5" fill="none" stroke="${stroke}" stroke-width="2" stroke-dasharray="3.5 2.5" />` +
      `<circle cx="14" cy="14" r="2" fill="${stroke}" />`;
  } else if (moving) {
    shape = `<path d="M14 3 L22 24 L14 19.5 L6 24 Z" fill="${fill}" stroke="var(--background)" stroke-width="1.5" stroke-linejoin="round" transform="rotate(${rotation} 14 14)" />`;
  } else {
    shape = `<path d="M14 6.5 L21.5 14 L14 21.5 L6.5 14 Z" fill="${fill}" stroke="var(--background)" stroke-width="1.5" stroke-linejoin="round" />`;
  }
  const severityRing = severity
    ? `<circle cx="14" cy="14" r="11" fill="none" stroke="${SEVERITY_VARS[severity]}" stroke-width="1.5" stroke-dasharray="3 2.5" />`
    : "";
  // Selection: filled halo + solid double-weight ring — unmissable on the chart
  const selectionRing = selected
    ? `<circle cx="14" cy="14" r="13" fill="var(--selection-token)" fill-opacity="0.18" />` +
      `<circle cx="14" cy="14" r="13" fill="none" stroke="var(--selection-token)" stroke-width="2.2" />`
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
