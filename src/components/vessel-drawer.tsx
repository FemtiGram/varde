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
 * Non-modal detail panel: the operator must be able to read details and watch
 * the map at the same time, so this is a persistent <aside>, not a dialog.
 *
 * The risk profile draws a hard, visible line between CONFIRMED data
 * (AIS-derived: identity, position, movement, flag state) and ILLUSTRATIVE
 * enrichment (insurance, age, sanctions — constructed demo values only).
 */
export function VesselDrawer() {
  const selectedContactId = useAppStore((s) => s.selectedContactId);
  const contact = useAppStore((s) =>
    s.selectedContactId != null ? s.contacts[s.selectedContactId] : undefined
  );
  const events = useAppStore((s) => s.events);
  const nowMs = useAppStore((s) => s.nowMs);
  const selectContact = useAppStore((s) => s.selectContact);
  const focusContact = useAppStore((s) => s.focusContact);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move reading focus to the drawer when a new contact is opened
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
      className="flex h-full w-80 min-h-0 shrink-0 flex-col border-l bg-card"
    >
      <header className="flex items-start justify-between gap-2 px-4 py-3">
        <div>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="font-mono text-base font-semibold outline-none"
          >
            {contact?.name ?? (isSensor ? "UKJENT KONTAKT" : "UKJENT FARTØY")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isSensor ? (
              <>Kilde: {contact.sourceLabel} · ingen AIS-identitet</>
            ) : (
              <>
                {shipTypeLabel(contact?.shipType ?? null)} · MMSI{" "}
                <span className="font-mono">{contact?.mmsi ?? "—"}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            title="Sentrer i kartet"
            aria-label="Sentrer kontakten i kartet"
            onClick={() => focusContact(selectedContactId)}
          >
            <Crosshair aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Lukk"
            aria-label="Lukk kontaktdetaljer"
            onClick={() => selectContact(null)}
          >
            <X aria-hidden />
          </Button>
        </div>
      </header>
      <Separator />

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          {latest ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
              <DataField
                label="Posisjon"
                value={formatPosition(latest.latitude, latest.longitude)}
                wide
              />
              <DataField label="Fart" value={formatSpeed(latest.speedOverGround)} />
              <DataField label="Kurs (COG)" value={formatCourse(latest.courseOverGround)} />
              <DataField
                label="Heading"
                value={latest.trueHeading != null ? `${latest.trueHeading}°` : "—"}
              />
              <DataField
                label="Siste melding"
                value={`${formatClockShort(latest.msgtime)} (${formatAge(
                  latest.msgtime,
                  nowMs
                )})`}
              />
              <DataField
                label="Spor (siste 90 min)"
                value={`${contact.track.length} posisjoner`}
              />
              <DataField label="Kilde" value={contact.sourceLabel} />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ingen posisjonsdata tilgjengelig for denne kontakten.
            </p>
          )}

          <Separator />

          {/* Risk profile */}
          {contact && risk && (
            <section aria-label="Risikoprofil">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Risikoprofil
                </h3>
                <RiskBadge level={risk.level} />
              </div>
              {risk.reasons.length > 0 && (
                <ul className="mb-3 flex flex-col gap-1">
                  {risk.reasons.map((reason) => (
                    <li
                      key={reason}
                      className="text-xs leading-snug text-muted-foreground"
                    >
                      · {reason}
                    </li>
                  ))}
                </ul>
              )}

              {/* Confirmed: AIS-derivable */}
              <div className="rounded-md border bg-background/50 p-2.5">
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge variant="secondary">Bekreftet</Badge>
                  <span className="text-[11px] text-muted-foreground">
                    Avledet fra AIS
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <DataField
                    label="Flaggstat"
                    value={
                      isSensor
                        ? "Ukjent (ingen AIS)"
                        : risk.flag
                          ? `${risk.flag.country ?? "Ukjent"} (MID ${risk.flag.mid})`
                          : "—"
                    }
                    wide
                  />
                  <DataField
                    label="Fartøystype"
                    value={isSensor ? "Ukjent" : shipTypeLabel(contact.shipType)}
                  />
                  <DataField
                    label="MMSI"
                    value={contact.mmsi != null ? String(contact.mmsi) : "—"}
                  />
                </dl>
              </div>

              {/* Illustrative enrichment — visibly different treatment */}
              <div className="mt-2 rounded-md border border-dashed border-status-warning/40 bg-background/30 p-2.5">
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-status-warning/50 text-status-warning"
                  >
                    Illustrativ
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    Ikke fra AIS — konstruert for demo
                  </span>
                </div>
                {risk.enrichment ? (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                    <DataField
                      label="Byggeår"
                      value={`${risk.enrichment.builtYear} (${
                        new Date(nowMs).getFullYear() - risk.enrichment.builtYear
                      } år)`}
                    />
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
                      label="Sanksjonsliste"
                      value={risk.enrichment.sanctionsMatch ? "TREFF" : "Ingen treff"}
                      wide
                    />
                  </dl>
                ) : (
                  <p className="text-xs leading-snug text-muted-foreground">
                    Ikke tilgjengelig. Forsikring, alder og sanksjonsstatus
                    hentes ikke fra åpne kilder i denne prototypen, og
                    konstrueres aldri for reelle fartøy.
                  </p>
                )}
              </div>
            </section>
          )}

          <Separator />

          <section aria-label="Aktive hendelser for kontakten">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Hendelser ({contactEvents.length})
            </h3>
            {contactEvents.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <StatusPill severity="ok" label="Normal" />
                <span>Ingen aktive hendelser.</span>
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {contactEvents.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-md border bg-background/50 p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StatusPill severity={event.severity} />
                        <span className="text-sm font-medium">
                          {EVENT_TYPE_LABELS[event.type]}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {formatAge(event.startedAt, nowMs)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                      {event.reason}
                    </p>
                    <DecisionActions event={event} className="mt-2" />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-[11px] leading-snug text-muted-foreground">
            Posisjon, fart, kurs og identitet er det kilden faktisk rapporterer.
            Berikelse utover dette er tydelig merket som illustrativ.
          </p>
        </div>
      </ScrollArea>
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
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={cn(wide && "col-span-2")}>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-sm">{value}</dd>
    </div>
  );
}
