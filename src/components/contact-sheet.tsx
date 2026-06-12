"use client";

import {
  Crosshair,
  ExternalLink,
  EyeOff,
  Flag,
  ShieldAlert,
  ShieldOff,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
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
import {
  riskProfile,
  type RiskLevel,
  type RiskReasonId,
} from "@/lib/risk";
import { shipTypeLabel } from "@/lib/ship-types";
import { useAppStore } from "@/lib/store";
import type { OperatorEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DecisionActions, DecisionButtons } from "./decision-actions";
import { ScoreBadge } from "./score-factors";
import { StatusPill } from "./status-pill";

/**
 * Contact details as a non-modal, resizable bottom sheet over the map.
 *
 * Zones are ordered identification-first, left to right:
 *   1. KONTAKT — positive identification before judgment: name, source and
 *      risk profile (confirmed vs illustrative clearly separated).
 *   2. VURDERING — why this contact demands attention (events, factor
 *      breakdown behind the score) and the decision itself, full-size actions.
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

  // Move reading focus into the sheet when a contact is opened from the map
  // or the board — but NOT while the operator is arrow-keying through the
  // queue, where stealing focus would kill the keyboard navigation.
  useEffect(() => {
    if (selectedContactId == null) return;
    if (document.activeElement?.closest("[data-event-queue]")) return;
    sheetRef.current?.focus();
  }, [selectedContactId]);

  if (selectedContactId == null) return null;

  const contactEvents = events
    .filter((e) => e.contactId === selectedContactId)
    .sort((a, b) => b.score - a.score);
  const topSeverity = contactEvents[0]?.severity ?? null;

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
        {/* 1 · KONTAKT — positive identification first: who is this, which source, how much to trust it */}
        <section
          aria-label="Kontakt og risiko"
          className="flex w-96 shrink-0 flex-col gap-2.5 overflow-y-auto p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {/* The name IS the lookup link — but only for REAL AIS contacts.
                  A constructed MMSI must never deep-link into a live registry. */}
              {!isSensor && contact?.mmsi != null && !contact.constructed ? (
                <a
                  href={`https://www.marinetraffic.com/no/ais/details/ships/mmsi:${contact.mmsi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Slå opp i MarineTraffic (åpnes i ny fane)"
                  className="group flex w-fit items-center gap-1.5 rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <h2 className="truncate font-mono text-lg font-semibold underline-offset-4 group-hover:underline">
                    {name}
                  </h2>
                  <ExternalLink
                    aria-hidden
                    className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground"
                  />
                  <span className="sr-only">
                    Slå opp i MarineTraffic (åpnes i ny fane)
                  </span>
                </a>
              ) : (
                <h2 className="truncate font-mono text-lg font-semibold">{name}</h2>
              )}
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

          {!isSensor && contact?.constructed && (
            <p className="text-xs text-muted-foreground">
              Eksternt oppslag utilgjengelig (konstruert demofartøy).
            </p>
          )}

          {risk && (
            <div className="flex items-baseline gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Risikoprofil
              </span>
              <RiskLevelText level={risk.level} />
            </div>
          )}
          {risk && risk.reasons.length > 0 && (
            <ul className="flex flex-col gap-1">
              {risk.reasons.map((reason) => (
                <li
                  key={reason.id}
                  className="flex items-start gap-1.5 text-sm leading-snug text-muted-foreground"
                >
                  <RiskReasonIcon id={reason.id} />
                  {reason.label}
                </li>
              ))}
            </ul>
          )}

          {/* Confirmed (AIS-derived) */}
          <div className="rounded-md border bg-background/50 p-2.5">
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Bekreftet · avledet fra AIS
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
                    risk?.flag ? (
                      <span className="flex items-center gap-1.5">
                        {risk.flag.iso && (
                          <span
                            aria-hidden
                            className={`fi fi-${risk.flag.iso} rounded-[2px]`}
                          />
                        )}
                        <span className="truncate">
                          {risk.flag.country ?? "Ukjent"} ({risk.flag.mid})
                        </span>
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
                <DataField label="Type" value={shipTypeLabel(contact?.shipType ?? null)} />
              </dl>
            )}
          </div>

          {/* Illustrative enrichment */}
          <div className="rounded-md border border-dashed border-status-warning/40 bg-background/30 p-2.5">
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wider">
              <span className="text-status-warning">Illustrativ</span>
              <span className="text-muted-foreground"> · ikke fra AIS</span>
            </div>
            {risk?.enrichment ? (
              <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5">
                <DataField label="Byggeår" value={String(risk.enrichment.builtYear)} />
                <DataField
                  label="Forsikring"
                  value={
                    risk.enrichment.insurance === "utløpt" ? (
                      <span className="flex items-center gap-1 text-status-warning">
                        <ShieldOff aria-hidden className="size-3.5 shrink-0" />
                        Utløpt
                      </span>
                    ) : risk.enrichment.insurance === "i-orden" ? (
                      "I orden"
                    ) : (
                      "Ukjent"
                    )
                  }
                />
                <DataField
                  label="Sanksjoner"
                  value={
                    risk.enrichment.sanctionsMatch ? (
                      <span className="flex items-center gap-1 font-semibold text-status-critical">
                        <ShieldAlert aria-hidden className="size-3.5 shrink-0" />
                        TREFF
                      </span>
                    ) : (
                      "Ingen treff"
                    )
                  }
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

        {/* 2 · VURDERING — why this needs attention + the decision */}
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
            {contactEvents.length > 0 ? (
              <div className="max-w-2xl pr-2">
                <AssessmentCard events={contactEvents} nowMs={nowMs} />
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

/**
 * One assessment card per CONTACT — the situation is the decision unit.
 * Events render as evidence rows; the prominent decision row at the bottom
 * acts on every open event at once. With several events, each row carries
 * compact per-event controls for the mixed cases (dismiss one signature,
 * escalate another) — the override is available but never the loudest thing.
 */
function AssessmentCard({
  events,
  nowMs,
}: {
  events: OperatorEvent[];
  nowMs: number;
}) {
  const decide = useAppStore((s) => s.decide);
  const single = events.length === 1;
  const open = events.filter((e) => e.decision === "none");
  const anyCriticalOpen = open.some((e) => e.severity === "critical");

  return (
    <div className="rounded-md border bg-background/50 p-3">
      {!single && (
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {events.length} aktive hendelser på samme kontakt
          </span>
        </div>
      )}

      <ul className={cn(!single && "divide-y divide-border/60")}>
        {events.map((event) => (
          <li key={event.id} className={cn(!single && "py-2.5 first:pt-1 last:pb-1")}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <StatusPill severity={event.severity} />
                <span className="truncate text-base font-semibold">
                  {EVENT_TYPE_LABELS[event.type]}
                </span>
              </div>
              <span className="flex shrink-0 items-baseline gap-2 font-mono text-xs text-muted-foreground">
                <ScoreBadge factors={event.factors} score={event.score} />
                {formatAge(event.startedAt, nowMs)}
              </span>
            </div>
            <p className="mt-1 text-sm leading-snug">{event.reason}</p>
            {/* Per-event override — compact, only in multi-event cards */}
            {!single &&
              (event.decision !== "none" ? (
                <DecisionActions event={event} className="mt-1.5" />
              ) : (
                <details className="mt-1">
                  <summary className="w-fit cursor-pointer text-xs text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                    Vurder denne hendelsen separat
                  </summary>
                  <DecisionActions event={event} className="mt-1.5" />
                </details>
              ))}
          </li>
        ))}
      </ul>

      {/* The decision — full-size, fixed place. Acts on the whole contact. */}
      {single ? (
        <DecisionActions event={events[0]} size="default" className="mt-3" />
      ) : open.length > 0 ? (
        <div className="mt-2 border-t border-border/60 pt-2.5">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Beslutning for hele kontakten ({open.length} åpne)
          </span>
          <DecisionButtons
            critical={anyCriticalOpen}
            size="default"
            onDecide={(decision) => {
              for (const e of open) decide(e.id, decision);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

const RISK_TEXT: Record<RiskLevel, { className: string; label: string }> = {
  høy: { className: "text-status-critical", label: "Høy" },
  forhøyet: { className: "text-status-warning", label: "Forhøyet" },
  lav: { className: "text-status-ok", label: "Lav" },
};

/** Risk is an ATTRIBUTE, not an alarm — coloured word, never a pill, so it
 * can't be mistaken for event severity. */
function RiskLevelText({ level }: { level: RiskLevel }) {
  const { className, label } = RISK_TEXT[level];
  return <span className={cn("text-sm font-semibold", className)}>{label}</span>;
}

/** Icons for risk reasons — always paired with their text label. */
const RISK_REASON_ICONS: Record<RiskReasonId, { Icon: typeof Flag; className: string }> = {
  sanctions: { Icon: ShieldAlert, className: "text-status-critical" },
  insurance: { Icon: ShieldOff, className: "text-status-warning" },
  flag: { Icon: Flag, className: "text-status-warning" },
  "no-ais": { Icon: EyeOff, className: "text-status-warning" },
};

function RiskReasonIcon({ id }: { id: RiskReasonId }) {
  const { Icon, className } = RISK_REASON_ICONS[id];
  return <Icon aria-hidden className={cn("mt-0.5 size-3.5 shrink-0", className)} />;
}

function DataField({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
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
