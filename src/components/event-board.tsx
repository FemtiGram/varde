"use client";

import { ArrowUpRight, Check, MapPin, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DECISION_LABELS, EVENT_TYPE_LABELS, formatAge, formatClockShort } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { EventDecision, EventSeverity, OperatorEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ScoreBadge } from "./score-factors";
import { StatusPill } from "./status-pill";

/**
 * Decision board: the event queue as columns per decision state, for working
 * through and reviewing how events were handled. Cards move between columns
 * by drag-and-drop or the equivalent buttons (keyboard-operable) — both paths
 * call the same store action, and every move is reversible.
 */

// Ordered by urgency of ownership: new work, then live responsibility
// (escalated, awaiting follow-up), then stable monitoring, then closed.
const COLUMNS: { decision: EventDecision; title: string; hint: string }[] = [
  { decision: "none", title: "Ny", hint: "Krever vurdering" },
  { decision: "escalated", title: "Eskalert", hint: "Sendt til vaktleder" },
  { decision: "acknowledged", title: "Kvittert", hint: "Sett og følges" },
  { decision: "dismissed", title: "Avvist", hint: "Ikke relevant" },
];

const STRIP_COLORS: Record<EventSeverity, string> = {
  critical: "bg-status-critical",
  warning: "bg-status-warning",
  info: "bg-status-info",
};

export function EventBoard() {
  const events = useAppStore((s) => s.events);
  const decide = useAppStore((s) => s.decide);
  const nowMs = useAppStore((s) => s.nowMs);
  const [dragOver, setDragOver] = useState<EventDecision | null>(null);

  const byColumn = useMemo(() => {
    const map = new Map<EventDecision, OperatorEvent[]>();
    for (const col of COLUMNS) map.set(col.decision, []);
    for (const e of events) map.get(e.decision)?.push(e);
    // "Ny" sorts by priority; decided columns by most recent decision
    map.get("none")?.sort((a, b) => b.score - a.score);
    for (const d of ["acknowledged", "escalated", "dismissed"] as const) {
      map.get(d)?.sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""));
    }
    return map;
  }, [events]);

  return (
    <div className="flex h-full min-h-0 gap-3 p-3" aria-label="Beslutningstavle">
      {COLUMNS.map((col) => {
        const items = byColumn.get(col.decision) ?? [];
        return (
          <section
            key={col.decision}
            aria-label={`${col.title} (${items.length})`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(col.decision);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const id = e.dataTransfer.getData("text/event-id");
              if (id) decide(id, col.decision);
            }}
            className={cn(
              "flex min-h-0 w-72 shrink-0 flex-col rounded-lg border bg-card",
              dragOver === col.decision && "border-selection/60 bg-accent/40"
            )}
          >
            <header className="flex items-baseline justify-between px-3 py-2.5">
              <div className="flex items-baseline gap-2">
                <h3 className="text-base font-semibold">{col.title}</h3>
                <span className="text-xs text-muted-foreground">{col.hint}</span>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {items.length}
              </span>
            </header>
            <ScrollArea className="min-h-0 flex-1 border-t">
              <div className="flex flex-col gap-2 p-2">
                {items.length === 0 && (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                    Ingen hendelser.
                  </p>
                )}
                {items.map((event) => (
                  <BoardCard key={event.id} event={event} nowMs={nowMs} />
                ))}
              </div>
            </ScrollArea>
          </section>
        );
      })}
    </div>
  );
}

function BoardCard({ event, nowMs }: { event: OperatorEvent; nowMs: number }) {
  const decide = useAppStore((s) => s.decide);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const setView = useAppStore((s) => s.setView);

  function moveButton(
    target: EventDecision,
    label: string,
    Icon: typeof Check,
    extraClass?: string
  ) {
    if (event.decision === target) return null;
    return (
      <Button
        key={target}
        variant="outline"
        size="icon-sm"
        title={label}
        aria-label={`${label}: ${event.contactName ?? event.contactId}`}
        className={extraClass}
        onClick={() => decide(event.id, target)}
      >
        <Icon aria-hidden />
      </Button>
    );
  }

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/event-id", event.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      aria-label={`${EVENT_TYPE_LABELS[event.type]}: ${event.contactName ?? event.contactId}`}
      className="relative cursor-grab overflow-hidden rounded-md border bg-background/50 py-2 pl-4 pr-2.5 active:cursor-grabbing"
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1 left-1 w-[3px] rounded-full",
          STRIP_COLORS[event.severity]
        )}
      />
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-mono text-base font-semibold">
          {event.contactName ?? "UKJENT KONTAKT"}
        </span>
        <span className="flex shrink-0 items-baseline gap-2">
          <ScoreBadge factors={event.factors} score={event.score} />
          <span className="font-mono text-xs text-muted-foreground">
            {formatAge(event.startedAt, nowMs)}
          </span>
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <StatusPill severity={event.severity} />
        <span className="truncate text-sm font-medium">
          {EVENT_TYPE_LABELS[event.type]}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted-foreground">
        {event.reason}
      </p>
      {event.decidedAt && (
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {DECISION_LABELS[event.decision]} kl. {formatClockShort(event.decidedAt)}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          {moveButton("acknowledged", "Flytt til Kvittert (K)", Check)}
          {moveButton(
            "escalated",
            "Flytt til Eskalert (E)",
            ArrowUpRight,
            "border-status-critical/40 text-status-critical hover:text-status-critical"
          )}
          {moveButton("dismissed", "Flytt til Avvist (X)", X)}
          {event.decision !== "none" &&
            moveButton("none", "Angre — tilbake til Ny (U)", RotateCcw)}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Vis i kartet"
          aria-label={`Vis ${event.contactName ?? "kontakten"} i kartet`}
          onClick={() => {
            selectEvent(event.id);
            setView("map");
          }}
        >
          <MapPin aria-hidden />
        </Button>
      </div>
    </article>
  );
}
