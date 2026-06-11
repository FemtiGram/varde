"use client";

import { useState } from "react";
import type { ScoreFactor } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Explainable score, visual form. Two variants:
 *  - "full" (Vurdering-panel): a segmented contribution bar answers "what
 *    dominates this score?" at a glance; chips below carry the details.
 *  - "compact" (queue rows): the three largest factors as chips plus an
 *    expandable "+N flere" — the full picture lives in the bottom sheet.
 *
 * The bar uses ONE hue in three strengths, grouped semantically
 * (grunnscore / kontekst / atferd+ferskhet) — proportion, not rainbow.
 * The chips are the accessible representation; the bar is decorative.
 */

type FactorGroup = "grunnscore" | "kontekst" | "atferd";

const GROUP_OF: Record<string, FactorGroup> = {
  base: "grunnscore",
  infra: "kontekst",
  zone: "kontekst",
  sanctions: "kontekst",
  flag: "kontekst",
  insurance: "kontekst",
  source: "kontekst",
  "long-gap": "atferd",
  "extreme-jump": "atferd",
  "long-loiter": "atferd",
  recency: "atferd",
};

const GROUP_STYLE: Record<FactorGroup, { bar: string; label: string }> = {
  grunnscore: { bar: "bg-primary", label: "Grunnscore" },
  kontekst: { bar: "bg-primary/55", label: "Kontekst" },
  atferd: { bar: "bg-primary/25", label: "Atferd og ferskhet" },
};

const GROUP_ORDER: FactorGroup[] = ["grunnscore", "kontekst", "atferd"];

function groupOf(factor: ScoreFactor): FactorGroup {
  return GROUP_OF[factor.id] ?? "kontekst";
}

export function ScoreFactors({
  factors,
  score,
  variant = "full",
  className,
}: {
  factors: ScoreFactor[];
  score: number;
  variant?: "full" | "compact";
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const sorted = [...factors].sort((a, b) => b.points - a.points);
  const compactCut = 3;
  const visible =
    variant === "compact" && !expanded ? sorted.slice(0, compactCut) : sorted;
  const hidden = sorted.length - visible.length;

  const groupTotals = GROUP_ORDER.map((group) => ({
    group,
    points: factors
      .filter((f) => groupOf(f) === group)
      .reduce((sum, f) => sum + f.points, 0),
  })).filter((g) => g.points > 0);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {variant === "full" && (
        <>
          {/* Contribution bar — decorative; the chips carry the content */}
          <div
            aria-hidden
            className="flex h-1.5 w-full gap-px overflow-hidden rounded-full"
          >
            {groupTotals.map(({ group, points }) => (
              <span
                key={group}
                title={`${GROUP_STYLE[group].label}: +${points}`}
                style={{ width: `${(points / score) * 100}%` }}
                className={GROUP_STYLE[group].bar}
              />
            ))}
          </div>
          <div aria-hidden className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {groupTotals.map(({ group, points }) => (
              <span key={group} className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className={cn("size-2 rounded-[2px]", GROUP_STYLE[group].bar)} />
                {GROUP_STYLE[group].label}
                <span className="font-mono tabular-nums">+{points}</span>
              </span>
            ))}
          </div>
        </>
      )}

      <ul
        aria-label={`Scorefaktorer, sum ${score}`}
        className="flex flex-wrap items-center gap-1"
      >
        {visible.map((f) => (
          <li
            key={f.id}
            className="flex items-baseline gap-1 rounded-sm border bg-background/50 px-1.5 py-0.5"
          >
            <span className="font-mono text-xs font-medium tabular-nums">
              +{f.points}
            </span>
            <span className="text-xs text-muted-foreground">{f.label}</span>
          </li>
        ))}
        {variant === "compact" && hidden > 0 && (
          <li>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(true);
              }}
              className="rounded-sm border border-dashed px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              +{hidden} flere
            </button>
          </li>
        )}
        {variant === "compact" && expanded && (
          <li>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(false);
              }}
              className="rounded-sm border border-dashed px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              vis færre
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
