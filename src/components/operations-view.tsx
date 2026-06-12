"use client";

import dynamic from "next/dynamic";
import { Toaster } from "@/components/ui/sonner";
import { useAlarmToasts } from "@/lib/use-alarm-toasts";
import { useDataEngine } from "@/lib/use-data-engine";
import { useAppStore } from "@/lib/store";
import { AppHeader } from "./app-header";
import { AppRail } from "./app-rail";
import { ContactSheet } from "./contact-sheet";
import { EventBoard } from "./event-board";
import { EventList } from "./event-list";
import { JournalView } from "./journal-view";
import { MapLayersControl } from "./map-layers-control";

// MapLibre needs the browser; skip SSR for the map only
const MapView = dynamic(() => import("./map-view").then((m) => m.MapView), {
  ssr: false,
});

/**
 * The workspace: rail (view switch) · header · content.
 * Map view: event queue + map + contact bottom sheet.
 * Board view: decision states as kanban columns.
 * The map stays mounted in the background when the board is active so
 * MapLibre keeps its state and the switch back is instant.
 */
export function OperationsView() {
  useDataEngine();
  useAlarmToasts();
  const view = useAppStore((s) => s.view);
  const sheetOpen = useAppStore(
    (s) => s.view === "map" && s.selectedContactId != null
  );
  const sheetHeight = useAppStore((s) => s.sheetHeight);

  // Toasts live in the map's lower-left corner with the same inset as the
  // Kartlag panel, riding on top of the bottom sheet when it is open.
  // Rail (48) + event queue (370) put the map's left edge at 418.
  const toastOffset = {
    left: view === "map" ? 48 + 370 + 12 : 48 + 12,
    bottom: sheetOpen ? sheetHeight + 12 : 12,
  };

  return (
    <div className="flex h-dvh">
      <AppRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <div className="relative min-h-0 flex-1">
          {/* Map workspace — kept mounted, hidden when the board is active */}
          <div
            className={view === "map" ? "flex h-full min-h-0" : "hidden"}
            aria-hidden={view !== "map"}
          >
            <div className="w-[370px] shrink-0 border-r bg-card">
              <EventList />
            </div>
            <main className="relative min-w-0 flex-1" aria-label="Operasjonskart">
              <MapView />
              <MapLayersControl />
              <ContactSheet />
            </main>
          </div>

          {view === "board" && (
            <main className="h-full min-h-0" aria-label="Beslutningstavle">
              <EventBoard />
            </main>
          )}

          {view === "journal" && (
            <main className="h-full min-h-0" aria-label="Journal">
              <JournalView />
            </main>
          )}
        </div>
      </div>
      <Toaster position="bottom-left" offset={toastOffset} mobileOffset={toastOffset} />
    </div>
  );
}
