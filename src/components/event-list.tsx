"use client";

import { useEffect, useMemo, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Kbd } from "@/components/ui/kbd";
import { CORRIDORS, ZONES } from "@/lib/config";
import { EVENT_TYPE_LABELS, formatAge } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { EventSeverity, OperatorEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DecisionActions } from "./decision-actions";
import { StatusPill } from "./status-pill";

/**
 * The prioritised queue. Highest score first; decided events drop into a
 * separate "handled" group below so the top of the list is always the answer
 * to "what needs me right now?". Selecting an event reveals its full factor
 * breakdown — the score is explainable, never a black box.
 *
 * Visual hierarchy (scan order): severity strip + pill → vessel → event type
 * → reason → metadata. Severity is triple-coded: colour strip, icon shape,
 * text label.
 *
 * Keyboard model: ↑/↓ move through events, Enter/Space selects (and focuses
 * the contact on the map), B/X/E decide, U undoes, Esc clears selection.
 */
export function EventList() {
  const events = useAppStore((s) => s.events);
  const selectedEventId = useAppStore((s) => s.selectedEventId);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const decide = useAppStore((s) => s.decide);
  const nowMs = useAppStore((s) => s.nowMs);
  const listRef = useRef<HTMLDivElement>(null);

  const { queue, handled } = useMemo(() => {
    const queue = events.filter((e) => e.decision === "none");
    const handled = events
      .filter((e) => e.decision !== "none")
      .sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""));
    return { queue, handled };
  }, [events]);

  const ordered = useMemo(() => [...queue, ...handled], [queue, handled]);

  // Roving focus: keep DOM focus on the selected row when navigating by keyboard
  useEffect(() => {
    if (!selectedEventId || !listRef.current) return;
    const active = document.activeElement;
    if (!listRef.current.contains(active)) return;
    const row = listRef.current.querySelector<HTMLElement>(
      `[data-event-id="${CSS.escape(selectedEventId)}"]`
    );
    if (row && row !== active) row.focus();
  }, [selectedEventId]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (ordered.length === 0) return;
    const idx = ordered.findIndex((ev) => ev.id === selectedEventId);
    const current = idx >= 0 ? ordered[idx] : null;

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next = ordered[Math.min(idx + 1, ordered.length - 1)];
        selectEvent(next.id);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const next = ordered[Math.max(idx - 1, 0)];
        selectEvent(next.id);
        break;
      }
      case "Escape":
        selectEvent(null);
        break;
      case "b":
      case "B":
        if (current && current.decision === "none") {
          e.preventDefault();
          decide(current.id, "acknowledged");
        }
        break;
      case "x":
      case "X":
        if (current && current.decision === "none") {
          e.preventDefault();
          decide(current.id, "dismissed");
        }
        break;
      case "e":
      case "E":
        if (current && current.decision === "none") {
          e.preventDefault();
          decide(current.id, "escalated");
        }
        break;
      case "u":
      case "U":
        if (current && current.decision !== "none") {
          e.preventDefault();
          decide(current.id, "none");
        }
        break;
    }
  }

  return (
    <section
      aria-label="Prioriterte hendelser"
      className="flex h-full min-h-0 flex-col"
    >
      <header className="flex items-center justify-between px-3 py-2.5">
        <h2 className="text-base font-semibold tracking-wide">Hendelser</h2>
        <span
          className="font-mono text-sm text-muted-foreground"
          aria-label={`${queue.length} hendelser krever vurdering`}
        >
          {queue.length} åpne
        </span>
      </header>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <div
          ref={listRef}
          onKeyDown={onKeyDown}
          className="flex flex-col gap-1.5 p-2"
        >
          {ordered.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Ingen aktive hendelser i området.
            </p>
          )}

          {queue.length > 0 && (
            <div className="px-2 pb-0.5 pt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Krever vurdering ({queue.length})
            </div>
          )}
          {queue.map((event, i) => (
            <EventRow
              key={event.id}
              event={event}
              nowMs={nowMs}
              selected={event.id === selectedEventId}
              tabIndex={
                selectedEventId
                  ? event.id === selectedEventId
                    ? 0
                    : -1
                  : i === 0
                    ? 0
                    : -1
              }
            />
          ))}

          {handled.length > 0 && (
            <>
              <div className="mt-3 px-2 pb-0.5 pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Håndtert ({handled.length})
              </div>
              {handled.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  nowMs={nowMs}
                  selected={event.id === selectedEventId}
                  tabIndex={event.id === selectedEventId ? 0 : -1}
                  muted
                />
              ))}
            </>
          )}
        </div>
      </ScrollArea>
      <Separator />
      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs text-muted-foreground">
        <span><Kbd>↑↓</Kbd> naviger</span>
        <span><Kbd>B</Kbd> bekreft</span>
        <span><Kbd>X</Kbd> avvis</span>
        <span><Kbd>E</Kbd> eskaler</span>
        <span><Kbd>U</Kbd> angre</span>
      </footer>
    </section>
  );
}

function areaName(zoneId: string | null): string | null {
  if (!zoneId) return null;
  return (
    ZONES.find((z) => z.id === zoneId)?.name ??
    CORRIDORS.find((c) => c.id === zoneId)?.name ??
    null
  );
}

const STRIP_COLORS: Record<EventSeverity, string> = {
  critical: "bg-status-critical",
  warning: "bg-status-warning",
  info: "bg-status-info",
};

export function EventRow({
  event,
  nowMs,
  selected,
  tabIndex,
  muted = false,
}: {
  event: OperatorEvent;
  nowMs: number;
  selected: boolean;
  tabIndex: number;
  muted?: boolean;
}) {
  const selectEvent = useAppStore((s) => s.selectEvent);
  const area = areaName(event.zoneId);

  return (
    <div
      role="button"
      data-event-id={event.id}
      tabIndex={tabIndex}
      aria-pressed={selected}
      aria-label={`${EVENT_TYPE_LABELS[event.type]}: ${
        event.contactName ?? event.contactId
      }. Prioritet ${event.score}. ${event.reason}`}
      onClick={() => selectEvent(event.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectEvent(event.id);
        }
      }}
      className={cn(
        "relative cursor-pointer overflow-hidden rounded-md border border-transparent py-2 pl-4 pr-2.5 text-left transition-colors",
        "hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-ring",
        selected && "border-selection/45 bg-accent",
        !selected && !muted && event.severity === "critical" && "bg-status-critical/5",
        muted && "opacity-55"
      )}
    >
      {/* Severity strip — colour-coded edge, paired with the pill's icon+text */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1 left-1 w-[3px] rounded-full",
          STRIP_COLORS[event.severity],
          muted && "opacity-50"
        )}
      />

      {/* Scan line 1: who */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-mono text-base font-semibold">
          {event.contactName ?? "UKJENT KONTAKT"}
        </span>
        <span className="flex shrink-0 items-baseline gap-2">
          <span
            className="rounded-sm border bg-background/60 px-1 font-mono text-xs tabular-nums text-muted-foreground"
            title={`Prioritetsscore ${event.score}`}
            aria-label={`Prioritetsscore ${event.score}`}
          >
            {event.score}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {formatAge(event.startedAt, nowMs)}
          </span>
        </span>
      </div>

      {/* Scan line 2: what */}
      <div className="mt-1 flex items-center gap-2">
        <StatusPill severity={event.severity} />
        <span className="truncate text-sm font-medium">
          {EVENT_TYPE_LABELS[event.type]}
        </span>
      </div>

      {/* Scan line 3: why + where */}
      <p className="mt-1 text-sm leading-snug text-muted-foreground">
        {event.reason}
      </p>
      {(event.mmsi != null || area) && (
        <div className="mt-0.5 flex items-baseline gap-2 text-xs text-muted-foreground">
          {event.mmsi != null && <span className="font-mono">{event.mmsi}</span>}
          {area && <span className="truncate">{area}</span>}
        </div>
      )}

      {selected && (
        <div className="mt-2 rounded-sm border border-border/60 bg-background/50 px-2 py-1.5">
          <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Hvorfor prioritert slik
          </span>
          <ul className="mt-1 flex flex-col gap-0.5">
            {event.factors.map((f) => (
              <li
                key={f.id}
                className="flex items-baseline justify-between gap-2 text-xs"
              >
                <span className="text-muted-foreground">{f.label}</span>
                <span className="font-mono tabular-nums">+{f.points}</span>
              </li>
            ))}
            <li className="mt-0.5 flex items-baseline justify-between gap-2 border-t border-border/60 pt-0.5 text-xs font-medium">
              <span>Sum</span>
              <span className="font-mono tabular-nums">{event.score}</span>
            </li>
          </ul>
        </div>
      )}
      {(selected || event.decision !== "none") && (
        <DecisionActions event={event} className="mt-2" />
      )}
    </div>
  );
}
