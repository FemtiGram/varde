"use client";

import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DECISION_LABELS,
  EVENT_TYPE_LABELS,
  SEVERITY_LABELS,
  formatClock,
  formatClockShort,
} from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { EventDecision } from "@/lib/types";

/**
 * The operator journal (vaktjournal): an append-only, timestamped record of
 * every decision and undo. The working state prunes itself over time; this
 * is what survives — and what a watch handover would lean on.
 * Session-scoped in this prototype (no persistence by design).
 */

const ACTION_LABELS: Record<EventDecision, string> = {
  ...DECISION_LABELS,
  none: "Angret",
};

/** Compose a watch-handover text from the current picture and the journal. */
function buildHandover(): string {
  const s = useAppStore.getState();
  const open = s.events.filter((e) => e.decision === "none");
  const criticals = open.filter((e) => e.severity === "critical");
  const others = open.filter((e) => e.severity !== "critical");
  const escalated = s.events.filter((e) => e.decision === "escalated");
  const utc = new Date().toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  const lines: string[] = [
    "VAKTOVERLEVERING — VARDE",
    `Generert ${formatClock(Date.now())} (${utc}Z) · Vakt: ${s.operator || "—"} · Modus: ${
      s.mode === "scenario" ? "Scenario (konstruerte data)" : "Direkte (BarentsWatch)"
    }`,
    "",
    `ÅPNE KRITISKE (${criticals.length}):`,
    ...criticals.map(
      (e) =>
        `- ${e.contactName ?? "UKJENT KONTAKT"}${e.mmsi ? ` (${e.mmsi})` : ""}: ${EVENT_TYPE_LABELS[e.type]} — ${e.reason}`
    ),
    ...(criticals.length === 0 ? ["- ingen"] : []),
    "",
    `ØVRIGE ÅPNE (${others.length}): ` +
      (["warning", "info"] as const)
        .map(
          (sev) =>
            `${others.filter((e) => e.severity === sev).length} ${SEVERITY_LABELS[sev].toLowerCase()}`
        )
        .join(", "),
    "",
    `ESKALERT — VENTER OPPFØLGING (${escalated.length}):`,
    ...escalated.map(
      (e) =>
        `- ${e.contactName ?? "UKJENT KONTAKT"}: ${EVENT_TYPE_LABELS[e.type]} (${e.decidedBy ?? "—"} kl. ${e.decidedAt ? formatClockShort(e.decidedAt) : "—"})`
    ),
    ...(escalated.length === 0 ? ["- ingen"] : []),
    "",
    `SISTE BESLUTNINGER (${Math.min(s.journal.length, 15)} av ${s.journal.length}):`,
    ...[...s.journal]
      .slice(-15)
      .reverse()
      .map(
        (j) =>
          `- ${formatClockShort(j.ts)} ${j.operator || "—"} ${
            j.action === "none" ? "Angret" : DECISION_LABELS[j.action]
          } — ${j.eventType ? EVENT_TYPE_LABELS[j.eventType] : "—"}, ${j.contactName ?? "UKJENT KONTAKT"}`
      ),
  ];
  return lines.join("\n");
}

export function JournalView() {
  const journal = useAppStore((s) => s.journal);
  const entries = [...journal].reverse();

  async function copyHandover() {
    try {
      await navigator.clipboard.writeText(buildHandover());
      toast.success("Vaktoverlevering kopiert til utklippstavlen.");
    } catch {
      toast.error("Fikk ikke tilgang til utklippstavlen.");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <header className="flex items-baseline justify-between px-1 pb-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-semibold">Journal</h2>
          <span className="text-xs text-muted-foreground">
            Alle beslutninger denne økten — slettes ikke selv om hendelsen
            utløper
          </span>
        </div>
        <span className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">
            {journal.length} oppføringer
          </span>
          <Button variant="outline" size="sm" onClick={copyHandover}>
            <ClipboardList data-icon="inline-start" aria-hidden />
            Kopier vaktoverlevering
          </Button>
        </span>
      </header>
      <div className="min-h-0 flex-1 rounded-lg border bg-card">
        {entries.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Ingen beslutninger tatt ennå. Kvitteringer, avvisninger,
            eskaleringer og angre-handlinger logges her med tidsstempel.
          </p>
        ) : (
          <ScrollArea className="h-full">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Tid</th>
                  <th className="px-3 py-2 font-medium">Vakt</th>
                  <th className="px-3 py-2 font-medium">Handling</th>
                  <th className="px-3 py-2 font-medium">Kontakt</th>
                  <th className="px-3 py-2 font-medium">Hendelse</th>
                  <th className="hidden px-3 py-2 font-medium md:table-cell">MMSI</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr
                    key={`${entry.ts}-${entry.eventId}-${i}`}
                    className="border-b last:border-0"
                  >
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-muted-foreground">
                      {formatClock(entry.ts)}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs">
                      {entry.operator || "—"}
                    </td>
                    <td className="px-3 py-1.5 font-medium">
                      {ACTION_LABELS[entry.action]}
                    </td>
                    <td className="px-3 py-1.5 font-mono">
                      {entry.contactName ?? "UKJENT KONTAKT"}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {entry.eventType ? EVENT_TYPE_LABELS[entry.eventType] : "—"}
                    </td>
                    <td className="hidden px-3 py-1.5 font-mono text-xs text-muted-foreground md:table-cell">
                      {entry.mmsi ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
