"use client";

import { ArrowUpRight, Check, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DECISION_LABELS } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { OperatorEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The decision affordance: every event can be explicitly acknowledged,
 * dismissed or escalated — and every decision can be undone. Keyboard:
 * B / X / E / U on the focused event row (wired in the event list).
 */
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
    <div className={cn("flex items-center gap-1.5", className)}>
      <Button
        variant="outline"
        size={size}
        title="Bekreft — sett, vurdert, følges (B)"
        onClick={(e) => {
          e.stopPropagation();
          decide(event.id, "acknowledged");
        }}
      >
        <Check data-icon="inline-start" aria-hidden />
        Bekreft
      </Button>
      <Button
        variant="outline"
        size={size}
        title="Avvis — ikke relevant (X)"
        onClick={(e) => {
          e.stopPropagation();
          decide(event.id, "dismissed");
        }}
      >
        <X data-icon="inline-start" aria-hidden />
        Avvis
      </Button>
      <Button
        variant="outline"
        size={size}
        className="border-status-critical/40 text-status-critical hover:text-status-critical"
        title="Eskaler — send videre til vaktleder (E)"
        onClick={(e) => {
          e.stopPropagation();
          decide(event.id, "escalated");
        }}
      >
        <ArrowUpRight data-icon="inline-start" aria-hidden />
        Eskaler
      </Button>
    </div>
  );
}
