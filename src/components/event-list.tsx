"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Kbd } from "@/components/ui/kbd";
import { CORRIDORS, QUEUE_PROFILES, ZONES } from "@/lib/config";
import { EVENT_TYPE_LABELS, formatAge } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { EventSeverity, OperatorEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DecisionActions } from "./decision-actions";
import { ScoreBadge } from "./score-factors";
import { StatusPill } from "./status-pill";

/**
 * The prioritised queue. Highest score first; decided events drop into a
 * separate "handled" group below so the top of the list is always the answer
 * to "what needs me right now?". The score chip opens the full factor
 * breakdown on demand — explainable, but not in the way.
 *
 * Visual hierarchy (scan order): severity strip + pill → vessel → event type
 * → reason → metadata. Severity is triple-coded: colour strip, icon shape,
 * text label.
 *
 * Keyboard model: ↑/↓ move through events, Enter/Space selects (and focuses
 * the contact on the map), K/X/E decide, U undoes, Esc clears selection.
 */
export function EventList() {
  const events = useAppStore((s) => s.events);
  const selectedEventId = useAppStore((s) => s.selectedEventId);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const decide = useAppStore((s) => s.decide);
  const nowMs = useAppStore((s) => s.nowMs);
  const seenEvents = useAppStore((s) => s.seenEvents);
  const contacts = useAppStore((s) => s.contacts);
  const focusContact = useAppStore((s) => s.focusContact);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  // EVE-overview-style filter: toggle severities in/out of the picture
  const [sevFilter, setSevFilter] = useState<Record<EventSeverity, boolean>>({
    critical: true,
    warning: true,
    info: true,
  });
  // Profile = named slice of the picture for a watch task (tabs above the queue)
  const [profileId, setProfileId] = useState("alt");
  // Roster toggle: also list vessels with no events (the green population)
  const [showAllShips, setShowAllShips] = useState(false);
  const profile = QUEUE_PROFILES.find((p) => p.id === profileId) ?? QUEUE_PROFILES[0];
  const inProfile = (e: OperatorEvent) =>
    profile.types == null || profile.types.includes(e.type);

  // "/" focuses the search from anywhere in the workspace
  useEffect(() => {
    function onSlash(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (e.key !== "/" || target.closest("input, textarea, [contenteditable]")) return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onSlash);
    return () => window.removeEventListener("keydown", onSlash);
  }, []);

  const q = query.trim().toLowerCase();

  const { queue, handled } = useMemo(() => {
    const matches = (e: OperatorEvent) =>
      q === "" ||
      (e.contactName ?? "").toLowerCase().includes(q) ||
      String(e.mmsi ?? "").includes(q) ||
      EVENT_TYPE_LABELS[e.type].toLowerCase().includes(q) ||
      (areaName(e.zoneId) ?? "").toLowerCase().includes(q);
    const prof =
      QUEUE_PROFILES.find((p) => p.id === profileId) ?? QUEUE_PROFILES[0];
    const visible = events.filter(
      (e) =>
        (prof.types == null || prof.types.includes(e.type)) &&
        sevFilter[e.severity] &&
        matches(e)
    );
    const queue = visible.filter((e) => e.decision === "none");
    const handled = visible
      .filter((e) => e.decision !== "none")
      .sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""));
    return { queue, handled };
  }, [events, q, sevFilter, profileId]);

  // Contacts with no visible event: top hits while searching, or the full
  // roster when "Alle skip" is toggled on
  const contactHits = useMemo(() => {
    if (q === "" && !showAllShips) return [];
    const represented = new Set(
      [...queue, ...handled].map((e) => e.contactId)
    );
    const hits = Object.values(contacts)
      .filter(
        (c) =>
          !represented.has(c.id) &&
          (q === "" ||
            (c.name ?? "").toLowerCase().includes(q) ||
            String(c.mmsi ?? "").includes(q))
      )
      .sort((a, b) => (a.name ?? String(a.mmsi)).localeCompare(b.name ?? String(b.mmsi), "nb"));
    return showAllShips ? hits : hits.slice(0, 5);
  }, [q, contacts, queue, handled, showAllShips]);

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

  /** Decide and advance to the next open event — inbox-style triage flow. */
  function decideAndAdvance(
    current: OperatorEvent,
    decision: "acknowledged" | "dismissed" | "escalated"
  ) {
    const qIdx = queue.findIndex((ev) => ev.id === current.id);
    const next = queue[qIdx + 1] ?? queue[qIdx - 1] ?? null;
    decide(current.id, decision);
    selectEvent(next ? next.id : null);
  }

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
      case "k":
      case "K":
        if (current && current.decision === "none") {
          e.preventDefault();
          decideAndAdvance(current, "acknowledged");
        }
        break;
      case "x":
      case "X":
        if (current && current.decision === "none") {
          e.preventDefault();
          decideAndAdvance(current, "dismissed");
        }
        break;
      case "e":
      case "E":
        if (current && current.decision === "none") {
          e.preventDefault();
          decideAndAdvance(current, "escalated");
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
      <div
        role="radiogroup"
        aria-label="Køprofil"
        className="flex items-center gap-0.5 px-2 pb-1.5"
      >
        {QUEUE_PROFILES.map((p) => {
          const count =
            p.types == null
              ? events.length
              : events.filter((e) => p.types!.includes(e.type)).length;
          const active = p.id === profileId;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setProfileId(p.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-sm px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-ring",
                active
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              {p.label}
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {count}
              </span>
            </button>
          );
        })}
      </div>
      <div className="px-2 pb-2">
        <div className="flex items-center gap-2 rounded-md border bg-background/60 px-2 focus-within:border-ring">
          <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Søk fartøy, MMSI, hendelse …"
            aria-label="Søk i hendelser og kontakter"
            className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Kbd className="shrink-0">/</Kbd>
        </div>
        <div
          className="mt-2 flex items-center gap-1"
          role="group"
          aria-label="Filtrer på alvorsgrad"
        >
          {(
            [
              ["critical", "Kritisk", "border-status-critical/50 text-status-critical"],
              ["warning", "Advarsel", "border-status-warning/50 text-status-warning"],
              ["info", "Info", "border-status-info/50 text-status-info"],
            ] as [EventSeverity, string, string][]
          ).map(([sev, label, activeClass]) => {
            const count = events.filter(
              (e) => inProfile(e) && e.severity === sev
            ).length;
            const active = sevFilter[sev];
            return (
              <button
                key={sev}
                type="button"
                aria-pressed={active}
                onClick={() => setSevFilter((f) => ({ ...f, [sev]: !f[sev] }))}
                className={cn(
                  "flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide focus-visible:outline-2 focus-visible:outline-ring",
                  active
                    ? cn("bg-background/60", activeClass)
                    : "border-transparent text-muted-foreground/60 line-through"
                )}
              >
                {label}
                <span className="font-mono tabular-nums">{count}</span>
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={showAllShips}
            title="Vis også fartøy uten hendelser"
            onClick={() => setShowAllShips((v) => !v)}
            className={cn(
              "ml-auto flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide focus-visible:outline-2 focus-visible:outline-ring",
              showAllShips
                ? "border-contact-ais/50 bg-background/60 text-contact-ais"
                : "border-transparent text-muted-foreground/60"
            )}
          >
            Alle skip
            <span className="font-mono tabular-nums">
              {Object.keys(contacts).length}
            </span>
          </button>
        </div>
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <div
          ref={listRef}
          data-event-queue
          onKeyDown={onKeyDown}
          className="flex flex-col gap-1.5 p-2"
        >
          {ordered.length === 0 && contactHits.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {q !== ""
                ? `Ingen treff på «${query}».`
                : profile.types != null
                  ? `Ingen hendelser i profilen «${profile.label}».`
                  : "Ingen aktive hendelser i området."}
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
              alarm={
                event.severity === "critical" && !seenEvents[event.id]
              }
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

          {contactHits.length > 0 && (
            <>
              <div className="mt-2 px-2 pb-0.5 pt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {showAllShips
                  ? `Fartøy uten hendelser (${contactHits.length})`
                  : `Kontakter uten hendelser (${contactHits.length})`}
              </div>
              {contactHits.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => focusContact(c.id)}
                  className="flex items-baseline justify-between gap-2 rounded-md border border-transparent px-2.5 py-1.5 text-left hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="truncate font-mono text-sm">
                    {c.name ?? (c.source !== "ais" ? "UKJENT KONTAKT" : String(c.mmsi))}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {c.mmsi ?? c.sourceLabel} · vis i kart
                  </span>
                </button>
              ))}
            </>
          )}

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
        <span><Kbd>K</Kbd> kvitter</span>
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
  alarm = false,
}: {
  event: OperatorEvent;
  nowMs: number;
  selected: boolean;
  tabIndex: number;
  muted?: boolean;
  /** Unacknowledged critical — the strip blinks until seen or decided */
  alarm?: boolean;
}) {
  const selectEvent = useAppStore((s) => s.selectEvent);

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
          muted && "opacity-50",
          alarm && "alarm-blink"
        )}
      />

      {/* Scan line 1: who */}
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
      {event.mmsi != null && (
        <div className="mt-0.5 text-xs text-muted-foreground">
          <span className="font-mono">{event.mmsi}</span>
        </div>
      )}

      {/* Decided state (with undo) only — undecided actions live in the sheet
          and on the K/X/E hotkeys, so the same buttons never appear twice */}
      {event.decision !== "none" && (
        <DecisionActions event={event} className="mt-2" />
      )}
    </div>
  );
}
