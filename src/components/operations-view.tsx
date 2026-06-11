"use client";

import dynamic from "next/dynamic";
import { useDataEngine } from "@/lib/use-data-engine";
import { AppHeader } from "./app-header";
import { EventList } from "./event-list";
import { MapLayersControl } from "./map-layers-control";
import { VesselDrawer } from "./vessel-drawer";

// MapLibre needs the browser; skip SSR for the map only
const MapView = dynamic(
  () => import("./map-view").then((m) => m.MapView),
  { ssr: false }
);

/** The single operational screen: event queue · map · detail drawer. */
export function OperationsView() {
  useDataEngine();

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <div className="w-[370px] shrink-0 border-r bg-card">
          <EventList />
        </div>
        <main className="relative min-w-0 flex-1" aria-label="Operasjonskart">
          <MapView />
          <MapLayersControl />
        </main>
        <VesselDrawer />
      </div>
    </div>
  );
}
