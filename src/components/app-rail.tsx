"use client";

import {
  BookOpen,
  Map as MapIcon,
  Palette,
  ScrollText,
  SquareKanban,
} from "lucide-react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Workspace rail: switches between the operational map and the decision
 * board, plus a link to the design system. Icon-only to keep the operational
 * screen wide; every item has a tooltip and accessible name.
 */
export function AppRail() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const openCount = useAppStore(
    (s) => s.events.filter((e) => e.decision === "none").length
  );

  return (
    <TooltipProvider delayDuration={300}>
      <nav
        aria-label="Arbeidsflater"
        className="flex w-12 shrink-0 flex-col items-center gap-1 border-r bg-card py-2"
      >
        <RailButton
          label="Kart — operasjonsbilde"
          active={view === "map"}
          onClick={() => setView("map")}
        >
          <MapIcon aria-hidden className="size-5" />
        </RailButton>
        <RailButton
          label={`Tavle — hendelseshåndtering (${openCount} åpne)`}
          active={view === "board"}
          onClick={() => setView("board")}
        >
          <SquareKanban aria-hidden className="size-5" />
          {openCount > 0 && (
            <span
              aria-hidden
              className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-warning px-1 font-mono text-[11px] font-semibold leading-none text-status-warning-foreground"
            >
              {openCount}
            </span>
          )}
        </RailButton>
        <RailButton
          label="Journal — beslutningslogg"
          active={view === "journal"}
          onClick={() => setView("journal")}
        >
          <ScrollText aria-hidden className="size-5" />
        </RailButton>
        <div className="mt-auto flex flex-col items-center gap-1">
          <Separator className="my-1 w-7" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/case"
                aria-label="Om prosjektet (case study)"
                className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <BookOpen aria-hidden className="size-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Om prosjektet</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/design-system"
                aria-label="Designsystem"
                className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Palette aria-hidden className="size-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Designsystem</TooltipContent>
          </Tooltip>
        </div>
      </nav>
    </TooltipProvider>
  );
}

function RailButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
          className={cn(
            "relative flex size-9 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            active
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          )}
        >
          {children}
          {active && (
            <span
              aria-hidden
              className="absolute -left-1.5 inset-y-1.5 w-[3px] rounded-full bg-selection"
            />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
