"use client";

import { ArrowUpRight, Check, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DECISION_LABELS, formatClockShort } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { EventDecision, OperatorEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The decision affordance: kvitter / avvis / eskaler, always undoable.
 * Keyboard: K / X / E / U on the focused event row (wired in the event list).
 *
 * Severity-adaptive emphasis: the visually primary button is the action the
 * scoring points toward. Normally that is Kvitter (most frequent, lowest
 * regret); for CRITICAL events Eskaler takes the solid treatment — the
 * interface recommends what the score concluded, without hiding the
 * alternatives. Avvis is always the most muted (it discards).
 */

/** Presentational button row — reused for single events and whole contacts. */
export function DecisionButtons({
  critical,
  onDecide,
  size = "sm",
  className,
}: {
  critical: boolean;
  onDecide: (decision: EventDecision) => void;
  size?: "sm" | "default";
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Button
        variant={critical ? "outline" : "default"}
        size={size}
        title="Kvitter — sett, vurdert, følges (K)"
        onClick={(e) => {
          e.stopPropagation();
          onDecide("acknowledged");
        }}
      >
        <Check data-icon="inline-start" aria-hidden />
        Kvitter
      </Button>
      <Button
        variant="ghost"
        size={size}
        title="Avvis — ikke relevant (X)"
        onClick={(e) => {
          e.stopPropagation();
          onDecide("dismissed");
        }}
      >
        <X data-icon="inline-start" aria-hidden />
        Avvis
      </Button>
      <Button
        variant={critical ? "destructive" : "outline"}
        size={size}
        className={
          critical
            ? undefined
            : "border-status-critical/40 text-status-critical hover:text-status-critical"
        }
        title="Eskaler — send videre til vaktleder (E)"
        onClick={(e) => {
          e.stopPropagation();
          onDecide("escalated");
        }}
      >
        <ArrowUpRight data-icon="inline-start" aria-hidden />
        Eskaler
      </Button>
    </div>
  );
}

/** Decision row bound to a single event, including its decided/undo state. */
export function DecisionActions({
  event,
  size = "sm",
  className,
}: {
  event: OperatorEvent;
  size?: "sm" | "default";
  className?: string;
}) {
  const decide = useAppStore((s) => s.decide);

  if (event.decision !== "none") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className="text-sm text-muted-foreground">
          {DECISION_LABELS[event.decision]}
          {event.decidedAt && (
            <span className="font-mono"> kl. {formatClockShort(event.decidedAt)}</span>
          )}
        </span>
        <Button
          variant="outline"
          size={size}
          onClick={(e) => {
            e.stopPropagation();
            decide(event.id, "none");
          }}
        >
          <RotateCcw data-icon="inline-start" aria-hidden />
          Angre
        </Button>
      </div>
    );
  }

  return (
    <DecisionButtons
      critical={event.severity === "critical"}
      onDecide={(decision) => decide(event.id, decision)}
      size={size}
      className={className}
    />
  );
}
