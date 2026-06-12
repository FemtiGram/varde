"use client";

import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ScoreFactor } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Explainable score, one click away. The score number itself is the entry
 * point: ScoreBadge renders the chip as a button that opens a popover with
 * the full breakdown (contribution bar + factor chips). The working surfaces
 * stay quiet — trained operators trust the ranking; the arithmetic is audit
 * material for handover, dispute and tuning.
 *
 * The bar uses ONE hue in three strengths, grouped semantically
 * (grunnscore / kontekst / atferd+ferskhet) — proportion, not rainbow.
 * The chip list is the accessible representation; the bar is decorative.
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

/** The full breakdown: contribution bar + chips. Lives inside the popover. */
export function ScoreFactors({
  factors,
  score,
  className,
}: {
  factors: ScoreFactor[];
  score: number;
  className?: string;
}) {
  const sorted = [...factors].sort((a, b) => b.points - a.points);
  const groupTotals = GROUP_ORDER.map((group) => ({
    group,
    points: factors
      .filter((f) => groupOf(f) === group)
      .reduce((sum, f) => sum + f.points, 0),
  })).filter((g) => g.points > 0);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
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
          <span
            key={group}
            className="flex items-center gap-1 text-xs text-muted-foreground"
          >
            <span className={cn("size-2 rounded-[2px]", GROUP_STYLE[group].bar)} />
            {GROUP_STYLE[group].label}
            <span className="font-mono tabular-nums">+{points}</span>
          </span>
        ))}
      </div>

      <ul
        aria-label={`Scorefaktorer, sum ${score}`}
        className="flex flex-wrap items-center gap-1"
      >
        {sorted.map((f) => (
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
      </ul>
    </div>
  );
}

/** The score chip as a button: click/Enter opens the explanation popover. */
export function ScoreBadge({
  factors,
  score,
  className,
}: {
  factors: ScoreFactor[];
  score: number;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Prioritetsscore ${score} — vis forklaring`}
          title="Hvorfor prioritert slik?"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className={cn(
            "group inline-flex items-center gap-1 rounded-sm border px-1.5 py-px font-mono text-xs tabular-nums",
            "border-border bg-background/60 text-foreground",
            "hover:border-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
            className
          )}
        >
          {score}
          <Info aria-hidden className="size-3 text-muted-foreground group-hover:text-primary" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-96"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Hvorfor prioritert slik
        </span>
        <ScoreFactors factors={factors} score={score} />
      </PopoverContent>
    </Popover>
  );
}
