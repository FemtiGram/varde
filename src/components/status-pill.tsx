import { CircleCheck, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEVERITY_LABELS } from "@/lib/format";
import type { EventSeverity } from "@/lib/types";

/**
 * Severity is always encoded threefold: colour + icon shape + text,
 * so meaning survives without colour vision.
 */
const SEVERITY_STYLES: Record<
  EventSeverity | "ok",
  { icon: typeof Info; className: string }
> = {
  critical: {
    icon: OctagonAlert,
    className: "bg-status-critical/15 text-status-critical border-status-critical/40",
  },
  warning: {
    icon: TriangleAlert,
    className: "bg-status-warning/15 text-status-warning border-status-warning/40",
  },
  info: {
    icon: Info,
    className: "bg-status-info/15 text-status-info border-status-info/40",
  },
  ok: {
    icon: CircleCheck,
    className: "bg-status-ok/15 text-status-ok border-status-ok/40",
  },
};

export function StatusPill({
  severity,
  label,
  className,
}: {
  severity: EventSeverity | "ok";
  label?: string;
  className?: string;
}) {
  const { icon: Icon, className: severityClass } = SEVERITY_STYLES[severity];
  const text =
    label ?? (severity === "ok" ? "OK" : SEVERITY_LABELS[severity as EventSeverity]);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        severityClass,
        className
      )}
    >
      <Icon aria-hidden className="size-3" />
      {text}
    </span>
  );
}
