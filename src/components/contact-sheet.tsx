"use client";

import { Crosshair, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { THRESHOLDS } from "@/lib/config";
import {
  EVENT_TYPE_LABELS,
  formatAge,
  formatClockShort,
  formatCourse,
  formatSpeed,
} from "@/lib/format";
import { formatPosition } from "@/lib/geo";
import { riskProfile, type RiskLevel } from "@/lib/risk";
import { shipTypeLabel } from "@/lib/ship-types";
import { useAppStore } from "@/lib/store";
import type { EventSeverity, OperatorEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DecisionActions } from "./decision-actions";
import { ScoreFactors } from "./score-factors";
import { StatusPill } from "./status-pill";

/**
 * Contact details as a non-modal, resizable bottom sheet over the map.
 *
 * Zones are ordered by the operator's decision flow, left to right:
 *   1. VURDERING — why this contact demands attention (primary event, factor
 *      breakdown) and the decision itself, with full-size actions.
 *   2. KONTAKT — who it is and how much to trust/suspect it (identity, source,
 *      risk profile; confirmed vs illustrative clearly separated).
 *   3. SANNTID — what it does right now (kinematics + data freshness; the age
 *      turns warning-coloured once it crosses the AIS-gap threshold).
 * The sheet's top border carries the highest active severity, so urgency is
 * visible before any text is read.
 */
export function ContactSheet() {
  const selectedContactId = useAppStore((s) => s.selectedContactId);
  const contact = useAppStore((s) =>
    s.selectedContactId != null ? s.contacts[s.selectedContactId] : undefined
  );
  const events = useAppStore((s) => s.events);
  const nowMs = useAppStore((s) => s.nowMs);
  const selectContact = useAppStore((s) => s.selectContact);
  const focusContact = useAppStore((s) => s.focusContact);
  const sheetHeight = useAppStore((s) => s.sheetHeight);
  const setSheetHeight = useAppStore((s) => s.setSheetHeight);
  const sheetRef = useRef<HTMLElement>(null);
  const dragState = useRef<{ startY: number; startHeight: number } | null>(null);

  // Move reading focus into the sheet when a new contact is opened
  useEffect(() => {
    if (selectedContactId != null) sheetRef.current?.focus();
  }, [selectedContactId]);

  if (selectedContactId == null) return null;

  const contactEvents = events
    .filter((e) => e.contactId === selectedContactId)
    .sort((a, b) => b.score - a.score);
  const primaryEvent = contactEvents[0] ?? null;
  const otherEvents = contactEvents.slice(1);
  const topSeverity = primaryEvent?.severity ?? null;

  const latest = contact?.latest;
  const isSensor = contact != null && contact.source !== "ais";
  const risk = contact ? riskProfile(contact) : null;
  const name = contact?.name ?? (isSensor ? "UKJENT KONTAKT" : "UKJENT FARTØY");

  const ageMin = latest
    ? (nowMs - new Date(latest.msgtime).getTime()) / 60_000
    : 0;
  const stale = ageMin >= THRESHOLDS.aisGapMinutes;

  return (
    <aside
      ref={sheetRef}
      tabIndex={-1}
      aria-label={`Kontaktdetaljer: ${name}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") selectContact(null);
      }}
      style={{ height: sheetHeight }}
      className={cn(
        "absolute inset-x-0 bottom-0 z-10 border-t-2 bg-card/95 outline-none backdrop-blur-sm animate-in slide-in-from-bottom-4 duration-200",
        topSeverity === "critical"
          ? "border-t-status-critical"
          : topSeverity === "warning"
            ? "border-t-status-warning"
            : topSeverity === "info"
              ? "border-t-status-info"
              : "border-t-border"
      )}
    >
      {/* Resize handle */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Endre høyde på detaljpanelet (piltaster opp/ned)"
        aria-valuenow={sheetHeight}
        aria-valuemin={220}
        aria-valuemax={520}
        tabIndex={0}
        onPointerDown={(e) => {
          dragState.current = { startY: e.clientY, startHeight: sheetHeight };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragState.current) return;
          setSheetHeight(
            dragState.current.startHeight + (dragState.current.startY - e.clientY)
          );
        }}
        onPointerUp={() => (dragState.current = null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setSheetHeight(sheetHeight + 24);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setSheetHeight(sheetHeight - 24);
          }
        }}
        className="group absolute -top-2 inset-x-0 z-10 flex h-3.5 cursor-row-resize items-center justify-center touch-none focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span
          aria-hidden
          className="h-1 w-12 rounded-full bg-border transition-colors group-hover:bg-selection/60 group-focus-visible:bg-selection"
        />
      </div>

      <div className="flex h-full min-h-0">
        {/* 1 · VURDERING — why this needs attention + the decision */}
        <section
          aria-label="Vurdering"
          className="flex min-w-0 flex-1 flex-col p-4 pb-0"
        >
          <div className="mb-1.5 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Vurdering
            </h3>
          </div>
          <ScrollArea className="min-h-0 flex-1 pb-4">
            {primaryEvent ? (
              <div className="flex flex-col gap-3 pr-2">
                <PrimaryEvent event={primaryEvent} nowMs={nowMs} />
                {otherEvents.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Øvrige hendelser ({otherEvents.length})
                    </span>
                    {otherEvents.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-md border bg-background/50 p-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <StatusPill severity={event.severity} />
                            <span className="truncate text-sm font-medium">
                              {EVENT_TYPE_LABELS[event.type]}
                            </span>
                          </div>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">
                            {formatAge(event.startedAt, nowMs)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-snug text-muted-foreground">
                          {event.reason}
                        </p>
                        <DecisionActions event={event} className="mt-1.5" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <StatusPill severity="ok" label="Normal" />
                <span>Ingen aktive hendelser for denne kontakten.</span>
              </div>
            )}
          </ScrollArea>
        </section>

        <Separator orientation="vertical" />

        {/* 2 · KONTAKT — identity, source and risk in one judgement */}
        <section
          aria-label="Kontakt og risiko"
          className="flex w-80 shrink-0 flex-col gap-2.5 overflow-y-auto p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate font-mono text-lg font-semibold">{name}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {isSensor ? (
                  <>Kilde: {contact.sourceLabel}</>
                ) : (
                  <>
                    {shipTypeLabel(contact?.shipType ?? null)} · MMSI{" "}
                    <span className="font-mono">{contact?.mmsi ?? "—"}</span>
                  </>
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Sentrer i kartet"
              aria-label="Sentrer kontakten i kartet"
              onClick={() => focusContact(selectedContactId)}
            >
              <Crosshair aria-hidden />
            </Button>
          </div>

          {risk && (
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Risikoprofil
              </span>
              <RiskBadge level={risk.level} />
            </div>
          )}
          {risk && risk.reasons.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {risk.reasons.map((reason) => (
                <li key={reason} className="text-sm leading-snug text-muted-foreground">
                  · {reason}
                </li>
              ))}
            </ul>
          )}

          {/* Confirmed (AIS-derived) */}
          <div className="rounded-md border bg-background/50 p-2.5">
            <div className="mb-1.5 flex items-center gap-2">
              <Badge variant="secondary">Bekreftet</Badge>
              <span className="text-xs text-muted-foreground">Avledet fra AIS</span>
            </div>
            {isSensor ? (
              <p className="text-sm leading-snug text-muted-foreground">
                Ingen AIS-identitet — kontakten finnes bare i sensorbildet.
              </p>
            ) : (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <DataField
                  label="Flaggstat"
                  value={
                    risk?.flag
                      ? `${risk.flag.country ?? "Ukjent"} (${risk.flag.mid})`
                      : "—"
                  }
                />
                <DataField label="Type" value={shipTypeLabel(contact?.shipType ?? null)} />
              </dl>
            )}
          </div>

          {/* Illustrative enrichment */}
          <div className="rounded-md border border-dashed border-status-warning/40 bg-background/30 p-2.5">
            <div className="mb-1.5 flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-status-warning/50 text-status-warning"
              >
                Illustrativ
              </Badge>
              <span className="text-xs text-muted-foreground">
                Ikke fra AIS — konstruert
              </span>
            </div>
            {risk?.enrichment ? (
              <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5">
                <DataField label="Byggeår" value={String(risk.enrichment.builtYear)} />
                <DataField
                  label="Forsikring"
                  value={
                    risk.enrichment.insurance === "i-orden"
                      ? "I orden"
                      : risk.enrichment.insurance === "utløpt"
                        ? "Utløpt"
                        : "Ukjent"
                  }
                />
                <DataField
                  label="Sanksjoner"
                  value={risk.enrichment.sanctionsMatch ? "TREFF" : "Ingen treff"}
                />
              </dl>
            ) : (
              <p className="text-sm leading-snug text-muted-foreground">
                Ikke tilgjengelig — konstrueres aldri for reelle fartøy.
              </p>
            )}
          </div>
        </section>

        <Separator orientation="vertical" />

        {/* 3 · SANNTID — kinematics + freshness */}
        <section
          aria-label="Sanntidsdata"
          className="flex w-60 shrink-0 flex-col overflow-y-auto p-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Sanntid
            </h3>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Lukk (Esc)"
              aria-label="Lukk kontaktdetaljer"
              onClick={() => selectContact(null)}
            >
              <X aria-hidden />
            </Button>
          </div>
          {latest ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
              <DataField label="Fart" value={formatSpeed(latest.speedOverGround)} />
              <DataField label="Kurs" value={formatCourse(latest.courseOverGround)} />
              <DataField
                label="Posisjon"
                value={formatPosition(latest.latitude, latest.longitude)}
                className="col-span-2"
              />
              <DataField
                label="Siste melding"
                value={`${formatClockShort(latest.msgtime)} (${formatAge(latest.msgtime, nowMs)})`}
                className={cn("col-span-2", stale && "[&>dd]:text-status-warning")}
              />
              <DataField label="Kilde" value={contact.sourceLabel} className="col-span-2" />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Ingen posisjonsdata.</p>
          )}
        </section>
      </div>
    </aside>
  );
}

/** The event that put this contact in front of the operator — full weight. */
function PrimaryEvent({ event, nowMs }: { event: OperatorEvent; nowMs: number }) {
  return (
    <div className="rounded-md border bg-background/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <StatusPill severity={event.severity} />
          <span className="truncate text-base font-semibold">
            {EVENT_TYPE_LABELS[event.type]}
          </span>
        </div>
        <span className="flex shrink-0 items-baseline gap-2 font-mono text-xs text-muted-foreground">
          <span className="rounded-sm border bg-background/60 px-1 tabular-nums">
            {event.score}
          </span>
          {formatAge(event.startedAt, nowMs)}
        </span>
      </div>
      <p className="mt-1.5 text-sm leading-snug">{event.reason}</p>

      <div className="mt-2.5">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Hvorfor prioritert slik
        </span>
        <ScoreFactors factors={event.factors} score={event.score} variant="full" />
      </div>

      {/* The decision — full-size, fixed place */}
      <DecisionActions event={event} size="default" className="mt-3" />
    </div>
  );
}

const RISK_STYLES: Record<RiskLevel, { severity: EventSeverity | "ok"; label: string }> = {
  høy: { severity: "critical", label: "Høy" },
  forhøyet: { severity: "warning", label: "Forhøyet" },
  lav: { severity: "ok", label: "Lav" },
};

function RiskBadge({ level }: { level: RiskLevel }) {
  const { severity, label } = RISK_STYLES[level];
  return <StatusPill severity={severity} label={label} />;
}

function DataField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-mono text-sm">{value}</dd>
    </div>
  );
}
