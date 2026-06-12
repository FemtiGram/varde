"use client";

import { ChevronDown, Ruler } from "lucide-react";
import { useEffect } from "react";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { VesselGlyph } from "./vessel-marker";

/**
 * Map layer toggles + a collapsible legend (tegnforklaring), so the symbol
 * vocabulary can be decoded without leaving the operational screen.
 */
export function MapLayersControl() {
  const showInfrastructure = useAppStore((s) => s.showInfrastructure);
  const setShowInfrastructure = useAppStore((s) => s.setShowInfrastructure);
  const mapGreyscale = useAppStore((s) => s.mapGreyscale);
  const setMapGreyscale = useAppStore((s) => s.setMapGreyscale);
  const [legendOpen, setLegendOpen] = useState(false);
  const measuring = useAppStore((s) => s.measuring);
  const setMeasuring = useAppStore((s) => s.setMeasuring);

  // M toggles measure mode (when not typing)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        (e.key === "m" || e.key === "M") &&
        !target.closest("input, textarea, [contenteditable]")
      ) {
        e.preventDefault();
        setMeasuring(!useAppStore.getState().measuring);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setMeasuring]);

  return (
    <div className="absolute left-3 top-3 flex w-64 flex-col gap-2 rounded-md border bg-card/90 px-3 py-2 backdrop-blur-sm">
      <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Kartlag
      </span>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Switch
          checked={showInfrastructure}
          onCheckedChange={setShowInfrastructure}
          aria-label="Vis kabelkorridorer (illustrative)"
        />
        <span className="flex items-center gap-1.5">
          {/* Dash-dot swatch mirrors the corridor line style — meaning beyond colour */}
          <svg width="22" height="8" aria-hidden className="shrink-0">
            <line
              x1="0"
              y1="4"
              x2="22"
              y2="4"
              stroke="var(--infra)"
              strokeWidth="2"
              strokeDasharray="1.5 2 6 2"
            />
          </svg>
          Kabelkorridorer
          <span className="text-muted-foreground">(illustrativ)</span>
        </span>
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Switch
          checked={mapGreyscale}
          onCheckedChange={setMapGreyscale}
          aria-label="Gråtone på sjøkartet"
        />
        <span>Gråtonekart</span>
      </label>

      <button
        type="button"
        aria-pressed={measuring}
        onClick={() => setMeasuring(!measuring)}
        title="Mål peiling og avstand: klikk origo, les av mot peker, klikk igjen for å låse. Esc avslutter. (M)"
        className={cn(
          "flex items-center gap-2 rounded-sm border px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-ring",
          measuring
            ? "border-selection/60 bg-accent text-foreground"
            : "border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        )}
      >
        <Ruler aria-hidden className="size-4" />
        Mål peiling/avstand
        {measuring && <span className="ml-auto text-xs text-muted-foreground">Esc avslutter</span>}
      </button>

      <button
        type="button"
        onClick={() => setLegendOpen((v) => !v)}
        aria-expanded={legendOpen}
        className="flex items-center justify-between gap-2 border-t pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        Tegnforklaring
        <ChevronDown
          aria-hidden
          className={cn("size-4 transition-transform", legendOpen && "rotate-180")}
        />
      </button>
      {legendOpen && (
        <ul className="flex flex-col gap-1.5 pb-1 text-sm">
          <LegendRow label="Fartøy i fart (AIS)">
            <VesselGlyph moving headingDeg={45} severity={null} selected={false} size={20} />
          </LegendRow>
          <LegendRow label="Stilleliggende fartøy">
            <VesselGlyph moving={false} headingDeg={null} severity={null} selected={false} size={20} />
          </LegendRow>
          <LegendRow label="Aktiv hendelse (farge = alvor)">
            <VesselGlyph moving headingDeg={45} severity="warning" selected={false} size={20} />
          </LegendRow>
          <LegendRow label="Kontakt uten AIS-identitet">
            <VesselGlyph source="sensor" moving headingDeg={null} severity="critical" selected={false} size={20} />
          </LegendRow>
          <LegendRow label="Mørkt fartøy — sist kjente posisjon (LKP)">
            <VesselGlyph moving headingDeg={45} severity="critical" selected={false} ghost size={20} />
          </LegendRow>
          <LegendRow label="Valgt kontakt">
            <VesselGlyph moving headingDeg={45} severity={null} selected size={20} />
          </LegendRow>
          <LegendRow label="Kursvektor (valgt fartøy, fremskrevet)">
            <svg width="20" height="8" aria-hidden>
              <line x1="0" y1="4" x2="20" y2="4" stroke="#566275" strokeWidth="2" strokeDasharray="3 3" />
            </svg>
          </LegendRow>
          <LegendRow label="Overvåkingssone">
            <svg width="20" height="8" aria-hidden>
              <line x1="0" y1="4" x2="20" y2="4" stroke="#5ec1d8" strokeWidth="2" strokeDasharray="6 3" />
            </svg>
          </LegendRow>
          <li className="pt-1 text-xs leading-snug text-muted-foreground">
            Blinking betyr én ting: en kritisk hendelse ingen har kvittert.
          </li>
        </ul>
      )}
    </div>
  );
}

function LegendRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="flex w-6 shrink-0 items-center justify-center">{children}</span>
      <span className="text-muted-foreground">{label}</span>
    </li>
  );
}
