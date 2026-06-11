"use client";

import { Crosshair, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import type { EventSeverity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DecisionActions } from "./decision-actions";
import { StatusPill } from "./status-pill";

/**
 * Contact details as a non-modal bottom sheet docked over the map's lower
 * edge (chart-plotter convention): the operator reads details and watches the
 * surface picture at the same time, and the map keeps its full width.
 *
 * The sheet is operator-resizable: drag the top handle, or focus it and use
 * the arrow keys. Height persists in the store across contacts.
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
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dragState = useRef<{ startY: number; startHeight: number } | null>(null);

  // Move reading focus into the sheet when a new contact is opened
  useEffect(() => {
    if (selectedContactId != null) headingRef.current?.focus();
  }, [selectedContactId]);

  if (selectedContactId == null) return null;

  const contactEvents = events.filter((e) => e.contactId === selectedContactId);
  const latest = contact?.latest;
  const isSensor = contact != null && contact.source !== "ais";
  const risk = contact ? riskProfile(contact) : null;

  return (
    <aside
      aria-label="Kontaktdetaljer"
      onKeyDown={(e) => {
        if (e.key === "Escape") selectContact(null);
      }}
      style={{ height: sheetHeight }}
      className="absolute inset-x-0 bottom-0 z-10 border-t bg-card/95 backdrop-blur-sm animate-in slide-in-from-bottom-4 duration-200"
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
        className="group absolute -top-1.5 inset-x-0 z-10 flex h-3.5 cursor-row-resize items-center justify-center touch-none focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span
          aria-hidden
          className="h-1 w-12 rounded-full bg-border transition-colors group-hover:bg-selection/60 group-focus-visible:bg-selection"
        />
      </div>

      <div className="flex h-full min-h-0">
        {/* Identity + risk level */}
        <div className="flex w-64 shrink-0 flex-col gap-2 overflow-y-auto p-4">
          <div className="flex items-start justify-between gap-2">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-mono text-lg font-semibold outline-none"
            >
              {contact?.name ?? (isSensor ? "UKJENT KONTAKT" : "UKJENT FARTØY")}
            </h2>
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
          <p className="text-sm text-muted-foreground">
            {isSensor ? (
              <>Kilde: {contact.sourceLabel} · ingen AIS-identitet</>
            ) : (
              <>
                {shipTypeLabel(contact?.shipType ?? null)} · MMSI{" "}
                <span className="font-mono">{contact?.mmsi ?? "—"}</span>
              </>
            )}
          </p>
          {risk && (
            <div className="mt-1 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Risikoprofil
                </span>
                <RiskBadge level={risk.level} />
              </div>
              {risk.reasons.length > 0 && (
                <ul className="flex flex-col gap-0.5">
                  {risk.reasons.map((reason) => (
                    <li key={reason} className="text-sm leading-snug text-muted-foreground">
                      · {reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <Separator orientation="vertical" />

        {/* Live data — what the source actually reports */}
        <div className="w-64 shrink-0 overflow-y-auto p-4">
          {latest ? (
            <dl className="grid grid-cols-1 gap-y-2.5">
              <DataField
                label="Posisjon"
                value={formatPosition(latest.latitude, latest.longitude)}
              />
              <div className="grid grid-cols-2 gap-x-3">
                <DataField label="Fart" value={formatSpeed(latest.speedOverGround)} />
                <DataField label="Kurs" value={formatCourse(latest.courseOverGround)} />
              </div>
              <div className="grid grid-cols-2 gap-x-3">
                <DataField
                  label="Siste melding"
                  value={`${formatClockShort(latest.msgtime)} (${formatAge(latest.msgtime, nowMs)})`}
                />
                <DataField label="Kilde" value={contact.sourceLabel} />
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Ingen posisjonsdata.</p>
          )}
        </div>

        <Separator orientation="vertical" />

        {/* Risk profile: confirmed vs illustrative, visibly separated */}
        {contact && risk && (
          <div className="flex w-80 shrink-0 flex-col gap-2 overflow-y-auto p-4">
            <div className="rounded-md border bg-background/50 p-2.5">
              <div className="mb-1.5 flex items-center gap-2">
                <Badge variant="secondary">Bekreftet</Badge>
                <span className="text-xs text-muted-foreground">Avledet fra AIS</span>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <DataField
                  label="Flaggstat"
                  value={
                    isSensor
                      ? "Ukjent"
                      : risk.flag
                        ? `${risk.flag.country ?? "Ukjent"} (${risk.flag.mid})`
                        : "—"
                  }
                />
                <DataField
                  label="Type"
                  value={isSensor ? "Ukjent" : shipTypeLabel(contact.shipType)}
                />
              </dl>
            </div>
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
              {risk.enrichment ? (
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
          </div>
        )}

        <Separator orientation="vertical" />

        {/* Active events for the contact */}
        <div className="flex min-w-0 flex-1 flex-col p-4 pb-0">
          <div className="mb-1.5 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Hendelser ({contactEvents.length})
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
          <ScrollArea className="min-h-0 flex-1 pb-4">
            {contactEvents.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <StatusPill severity="ok" label="Normal" />
                <span>Ingen aktive hendelser.</span>
              </div>
            ) : (
              <ul className="flex flex-col gap-2 pr-2">
                {contactEvents.map((event) => (
                  <li key={event.id} className="rounded-md border bg-background/50 p-2.5">
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
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
      </div>
    </aside>
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
