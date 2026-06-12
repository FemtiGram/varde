import type { EventSeverity, EventType } from "./types";

export function formatClock(iso: string | number): string {
  return new Date(iso).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatClockShort(iso: string | number): string {
  return new Date(iso).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Relative age against the operational clock ("nå", "4 min", "1 t 12 min"). */
export function formatAge(iso: string, nowMs: number): string {
  const min = Math.floor((nowMs - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "nå";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} t ${min % 60} min`;
}

export function formatSpeed(sog: number | null): string {
  return sog == null ? "—" : `${sog.toFixed(1)} kn`;
}

export function formatCourse(cog: number | null): string {
  return cog == null ? "—" : `${String(Math.round(cog)).padStart(3, "0")}°`;
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  "ais-gap": "AIS-bortfall",
  "ais-jump": "AIS-sprang",
  "zone-entry": "Soneinngang",
  loitering: "Lav fart i sone",
  "cable-loiter": "Lav fart i kabelkorridor",
  "dark-contact": "Kontakt uten AIS",
};

export const SEVERITY_LABELS: Record<EventSeverity, string> = {
  critical: "Kritisk",
  warning: "Advarsel",
  info: "Info",
};

export const DECISION_LABELS = {
  none: "Ikke vurdert",
  acknowledged: "Kvittert",
  dismissed: "Avvist",
  escalated: "Eskalert",
} as const;
