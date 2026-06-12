"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { EVENT_TYPE_LABELS } from "./format";
import { useAppStore } from "./store";

/**
 * Toast channel for NEW criticals (paired with the blink discipline): a
 * transient announcement when an event turns critical, with a jump action.
 * Sonner's live region doubles as the screen-reader alarm channel — blinking
 * alone is invisible to SR users.
 *
 * The first non-empty event batch is registered silently so loading a scene
 * (or restarting the scenario) never opens with a toast flood.
 */
export function useAlarmToasts() {
  const initialised = useRef(false);
  const announced = useRef(new Set<string>());

  useEffect(() => {
    return useAppStore.subscribe((state) => {
      const criticals = state.events.filter((e) => e.severity === "critical");

      // Scene reset (mode switch / scenario restart) → re-arm silently
      if (state.events.length === 0 && Object.keys(state.contacts).length === 0) {
        initialised.current = false;
        announced.current.clear();
        return;
      }
      if (!initialised.current) {
        if (state.events.length === 0) return;
        for (const e of criticals) announced.current.add(e.id);
        initialised.current = true;
        return;
      }

      for (const e of criticals) {
        if (announced.current.has(e.id)) continue;
        announced.current.add(e.id);
        toast.warning(
          `KRITISK · ${EVENT_TYPE_LABELS[e.type]} — ${e.contactName ?? "UKJENT KONTAKT"}`,
          {
            description: e.reason,
            duration: 8000,
            action: {
              label: "Vis",
              onClick: () => useAppStore.getState().selectEvent(e.id),
            },
          }
        );
      }
    });
  }, []);
}
