"use client";

import { useEffect } from "react";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { THRESHOLDS } from "@/lib/config";
import { formatClock } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { AboutDialog } from "./about-dialog";

export function AppHeader() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const restartScenario = useAppStore((s) => s.restartScenario);
  const liveStatus = useAppStore((s) => s.liveStatus);
  const nowMs = useAppStore((s) => s.nowMs);
  const contactCount = useAppStore((s) => Object.keys(s.contacts).length);
  const operator = useAppStore((s) => s.operator);
  const setOperator = useAppStore((s) => s.setOperator);
  // Alarm-flood (EEMUA 191): new events inside the rolling window
  const floodCount = useAppStore((s) => {
    const windowMs = THRESHOLDS.alarmFloodWindowMinutes * 60_000;
    return Object.values(s.eventFirstSeen).filter((ts) => s.nowMs - ts <= windowMs)
      .length;
  });
  const flood = floodCount >= THRESHOLDS.alarmFloodThreshold;

  // Restore the operator signature persisted from earlier watches
  useEffect(() => {
    const saved = window.localStorage.getItem("varde-operator");
    if (saved) setOperator(saved);
  }, [setOperator]);

  const statusText =
    mode === "scenario"
      ? `Scenario · konstruerte data · ${THRESHOLDS.scenarioSpeedup}× hastighet`
      : liveStatus === "ok"
        ? "Direkte · BarentsWatch"
        : liveStatus === "connecting"
          ? "Kobler til …"
          : liveStatus === "no-credentials"
            ? "Direktedata mangler API-nøkler"
            : "Direktedata utilgjengelig";

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card px-3">
      <h1 className="text-base font-semibold tracking-[0.2em]">VARDE</h1>
      <span className="hidden text-sm text-muted-foreground md:inline">
        Maritim situasjonsoversikt · Indre Oslofjord
      </span>

      <Separator orientation="vertical" className="h-5" />

      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={mode}
        onValueChange={(v) => {
          if (v === "live" || v === "scenario") setMode(v);
        }}
        aria-label="Datakilde"
      >
        <ToggleGroupItem value="live">Direkte</ToggleGroupItem>
        <ToggleGroupItem value="scenario">Scenario</ToggleGroupItem>
      </ToggleGroup>

      {mode === "scenario" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={restartScenario}
          title="Start scenarioet på nytt"
        >
          <RotateCcw data-icon="inline-start" aria-hidden />
          Start på nytt
        </Button>
      )}

      <div className="ml-auto flex items-center gap-3">
        <span
          role="status"
          className={cn(
            "flex items-center gap-1.5 text-sm",
            mode === "live" && liveStatus !== "ok" && liveStatus !== "connecting"
              ? "text-status-warning"
              : "text-muted-foreground"
          )}
        >
          <span
            aria-hidden
            className={cn(
              "inline-block size-1.5 rounded-full",
              mode === "scenario"
                ? "bg-status-info"
                : liveStatus === "ok"
                  ? "bg-status-ok"
                  : "bg-status-warning"
            )}
          />
          {statusText}
        </span>
        <span className="hidden font-mono text-sm text-muted-foreground sm:inline">
          {contactCount} kontakter
        </span>
        <span
          className={cn(
            "hidden items-center gap-1 font-mono text-sm sm:flex",
            flood ? "font-semibold text-status-warning" : "text-muted-foreground"
          )}
          title={`Nye hendelser siste ${THRESHOLDS.alarmFloodWindowMinutes} min. Over ${THRESHOLDS.alarmFloodThreshold} regnes som hendelsesflom (EEMUA 191) — da er systemet, ikke operatøren, problemet.`}
        >
          {floodCount}/{THRESHOLDS.alarmFloodWindowMinutes}min
          {flood && <span className="text-xs uppercase">flom</span>}
        </span>
        <label className="flex items-center gap-1.5 font-mono text-sm text-muted-foreground">
          <span className="text-xs uppercase tracking-wider">Vakt</span>
          <input
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            aria-label="Operatørsignatur — stemples på beslutninger og journal"
            title="Operatørsignatur — stemples på beslutninger og journal"
            size={4}
            maxLength={4}
            className="w-12 rounded-sm border bg-background/60 px-1.5 py-0.5 text-center uppercase text-foreground outline-none focus-visible:border-ring"
          />
        </label>
        <span
          className="font-mono text-sm tabular-nums"
          aria-label="Operasjonsklokke"
          suppressHydrationWarning
        >
          {formatClock(nowMs)}
          {/* suppressHydrationWarning is per-element — the nested span needs its own */}
          <span
            className="ml-2 text-muted-foreground"
            aria-label="UTC-tid"
            suppressHydrationWarning
          >
            {new Date(nowMs).toLocaleTimeString("nb-NO", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC",
            })}
            Z
          </span>
        </span>
        <AboutDialog />
      </div>
    </header>
  );
}
