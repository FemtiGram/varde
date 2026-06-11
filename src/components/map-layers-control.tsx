"use client";

import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/lib/store";

/** Map layer toggles — infrastructure context on demand, not clutter. */
export function MapLayersControl() {
  const showInfrastructure = useAppStore((s) => s.showInfrastructure);
  const setShowInfrastructure = useAppStore((s) => s.setShowInfrastructure);

  return (
    <div className="absolute left-3 top-3 rounded-md border bg-card/90 px-3 py-2 backdrop-blur-sm">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Kartlag
      </span>
      <label className="flex cursor-pointer items-center gap-2 text-xs">
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
    </div>
  );
}
