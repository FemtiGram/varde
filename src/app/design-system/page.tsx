"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { DecisionActions } from "@/components/decision-actions";
import { EventRow } from "@/components/event-list";
import { StatusPill } from "@/components/status-pill";
import { VesselGlyph } from "@/components/vessel-marker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/lib/store";
import type { OperatorEvent } from "@/lib/types";

/**
 * Living design system: every swatch, type sample and component on this page
 * reads the SAME tokens and components as the app itself. Contrast values are
 * measured in the browser from the rendered colours, not hand-maintained.
 */

const COLOR_TOKENS = [
  { name: "--background", on: null },
  { name: "--foreground", on: "--background" },
  { name: "--card", on: null },
  { name: "--muted-foreground", on: "--background" },
  { name: "--primary", on: "--background" },
  { name: "--selection-token", on: "--background" },
  { name: "--status-critical", on: "--background" },
  { name: "--status-warning", on: "--background" },
  { name: "--status-info", on: "--background" },
  { name: "--status-ok", on: "--background" },
  { name: "--status-critical-foreground", on: "--status-critical" },
  { name: "--status-warning-foreground", on: "--status-warning" },
  { name: "--infra", on: "--background" },
  { name: "--contact-unknown", on: "--background" },
] as const;

/** Resolve any CSS colour to sRGB bytes via canvas. */
function resolveColor(css: string): [number, number, number] | null {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = "#000";
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(
  a: [number, number, number],
  b: [number, number, number]
): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

interface TokenInfo {
  name: string;
  value: string;
  contrast: number | null;
  on: string | null;
}

function useTokenInfo(): TokenInfo[] {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  useEffect(() => {
    // Measure after paint so the rendered token values are what we report
    const id = requestAnimationFrame(() => {
      const styles = getComputedStyle(document.documentElement);
      setTokens(
        COLOR_TOKENS.map(({ name, on }) => {
          const value = styles.getPropertyValue(name).trim();
          let contrast: number | null = null;
          if (on) {
            const fg = resolveColor(value);
            const bg = resolveColor(styles.getPropertyValue(on).trim());
            if (fg && bg) contrast = contrastRatio(fg, bg);
          }
          return { name, value, contrast, on };
        })
      );
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return tokens;
}

const SAMPLE_EVENT: Omit<OperatorEvent, "decision" | "decidedAt"> = {
  id: "demo:cable-loiter",
  type: "cable-loiter",
  severity: "critical",
  contactId: "ais:257300304",
  contactName: "GRÅHOLM",
  mmsi: 257300304,
  zoneId: "k1",
  startedAt: new Date(Date.now() - 22 * 60_000).toISOString(),
  updatedAt: new Date().toISOString(),
  reason:
    "Under 1.5 kn i K1 · Kabelkorridor (illustrativ) i 22 min, forflyttet 0.5 nm langs korridoren — mønster forenlig med ankerdragging.",
  score: 95,
  factors: [
    { id: "base", label: "Grunnscore: lav fart i kabelkorridor", points: 55 },
    { id: "infra", label: "Inne i kabelkorridor", points: 25 },
    { id: "recency", label: "Nylig oppstått", points: 15 },
  ],
  active: true,
};

/** Live demo row: decisions round-trip through the real store. */
function DemoEventRow() {
  const decision = useAppStore(
    (s) => s.decisions[SAMPLE_EVENT.id]?.decision ?? "none"
  );
  const decidedAt = useAppStore(
    (s) => s.decisions[SAMPLE_EVENT.id]?.decidedAt ?? null
  );
  const selected = useAppStore((s) => s.selectedEventId === SAMPLE_EVENT.id);
  const [nowMs] = useState(() => Date.now());
  const event: OperatorEvent = { ...SAMPLE_EVENT, decision, decidedAt };
  return (
    <EventRow event={event} nowMs={nowMs} selected={selected} tabIndex={0} />
  );
}

export default function DesignSystemPage() {
  const tokens = useTokenInfo();

  return (
    <div className="h-dvh overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-10">
        <header className="flex flex-col gap-2">
          <Link
            href="/"
            className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Tilbake til operasjonsbildet
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            VARDE designsystem
          </h1>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            Token, typografi og kjernekomponenter — de samme som appen bruker.
            Kontrastverdiene måles i nettleseren fra de faktisk rendrede
            fargene mot WCAG AA (4.5:1 for tekst, 3:1 for store/grafiske
            elementer).
          </p>
        </header>

        <section aria-labelledby="ds-colors" className="flex flex-col gap-3">
          <h2 id="ds-colors" className="text-lg font-medium">
            Farge- og statustoken
          </h2>
          <p className="text-sm text-muted-foreground">
            Farge er funksjonell: status, alarmnivå og seleksjon — aldri
            dekorasjon. Mening bæres alltid også av form, ikon eller tekst.
          </p>
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-card text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Token</th>
                  <th className="px-3 py-2 font-medium">Prøve</th>
                  <th className="px-3 py-2 font-medium">Verdi</th>
                  <th className="px-3 py-2 font-medium">Kontrast</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.name} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{t.name}</td>
                    <td className="px-3 py-2">
                      <span
                        aria-hidden
                        className="inline-block size-5 rounded-sm border align-middle"
                        style={{ backgroundColor: `var(${t.name})` }}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {t.value || "…"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {t.contrast == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          {t.contrast.toFixed(2)}:1{" "}
                          <Badge
                            variant={t.contrast >= 4.5 ? "secondary" : "outline"}
                          >
                            {t.contrast >= 4.5
                              ? "AA"
                              : t.contrast >= 3
                                ? "AA stor/grafikk"
                                : "Under AA"}
                          </Badge>
                          <span className="text-muted-foreground">
                            mot {t.on}
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Separator />

        <section aria-labelledby="ds-type" className="flex flex-col gap-3">
          <h2 id="ds-type" className="text-lg font-medium">
            Typografi
          </h2>
          <p className="text-sm text-muted-foreground">
            Geist Sans for grensesnitt, Geist Mono for data: koordinater, MMSI,
            fart og tidsstempler.
          </p>
          <div className="flex flex-col gap-4 rounded-md border p-4">
            <div className="flex flex-col gap-2">
              <span className="text-2xl font-semibold">Aa — 24/semibold · sidetittel</span>
              <span className="text-lg font-medium">Aa — 18/medium · seksjonstittel</span>
              <span className="text-sm font-medium">Aa — 14/medium · radtittel og knapper</span>
              <span className="text-sm">Aa — 14/regular · brødtekst</span>
              <span className="text-xs text-muted-foreground">
                Aa — 12/regular · sekundærtekst
              </span>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Aa — 11/caps · feltetiketter
              </span>
            </div>
            <Separator />
            <div className="flex flex-col gap-1 font-mono">
              <span className="text-sm">59°27.12&apos;N 010°30.45&apos;E · 12.4 kn · 037°</span>
              <span className="text-xs text-muted-foreground">
                MMSI 257300301 · 14:02:36 — Geist Mono, tabulære tall
              </span>
            </div>
          </div>
        </section>

        <Separator />

        <section aria-labelledby="ds-spacing" className="flex flex-col gap-3">
          <h2 id="ds-spacing" className="text-lg font-medium">
            Avstand
          </h2>
          <p className="text-sm text-muted-foreground">
            4 px-basert skala (Tailwind). Tett, men luftig nok til rask
            skanning i datalister.
          </p>
          <div className="flex items-end gap-3 rounded-md border p-4">
            {[1, 2, 3, 4, 6, 8].map((step) => (
              <div key={step} className="flex flex-col items-center gap-1.5">
                <div
                  className="w-8 rounded-sm bg-primary/60"
                  style={{ height: `${step * 4}px` }}
                />
                <span className="font-mono text-[11px] text-muted-foreground">
                  {step * 4}
                </span>
              </div>
            ))}
          </div>
        </section>

        <Separator />

        <section aria-labelledby="ds-markers" className="flex flex-col gap-3">
          <h2 id="ds-markers" className="text-lg font-medium">
            Fartøysmarkører
          </h2>
          <p className="text-sm text-muted-foreground">
            Status kodes med form først, farge etterpå: pil = i fart (rotert
            mot kurs), diamant = stilleliggende, stiplet ring = aktiv hendelse,
            hel ring = valgt.
          </p>
          <div className="grid grid-cols-2 gap-4 rounded-md border p-4 sm:grid-cols-3">
            <MarkerSample label="I fart, normal">
              <VesselGlyph moving headingDeg={40} severity={null} selected={false} size={34} />
            </MarkerSample>
            <MarkerSample label="Stilleliggende, normal">
              <VesselGlyph moving={false} headingDeg={null} severity={null} selected={false} size={34} />
            </MarkerSample>
            <MarkerSample label="Valgt">
              <VesselGlyph moving headingDeg={310} severity={null} selected size={34} />
            </MarkerSample>
            <MarkerSample label="Hendelse · kritisk">
              <VesselGlyph moving={false} headingDeg={null} severity="critical" selected={false} size={34} />
            </MarkerSample>
            <MarkerSample label="Hendelse · advarsel">
              <VesselGlyph moving headingDeg={130} severity="warning" selected={false} size={34} />
            </MarkerSample>
            <MarkerSample label="Hendelse + valgt">
              <VesselGlyph moving headingDeg={210} severity="warning" selected size={34} />
            </MarkerSample>
            <MarkerSample label="Kontakt uten AIS (sensor)">
              <VesselGlyph source="sensor" moving headingDeg={null} severity={null} selected={false} size={34} />
            </MarkerSample>
            <MarkerSample label="Kontakt uten AIS · kritisk">
              <VesselGlyph source="sensor" moving headingDeg={null} severity="critical" selected={false} size={34} />
            </MarkerSample>
          </div>
        </section>

        <Separator />

        <section aria-labelledby="ds-areas" className="flex flex-col gap-3">
          <h2 id="ds-areas" className="text-lg font-medium">
            Kartområder
          </h2>
          <p className="text-sm text-muted-foreground">
            Soner og infrastruktur har hver sin strektype i tillegg til farge,
            slik at de kan skilles uten fargesyn.
          </p>
          <div className="flex flex-col gap-3 rounded-md border p-4">
            <div className="flex items-center gap-3">
              <svg width="80" height="10" aria-hidden className="shrink-0">
                <line x1="0" y1="5" x2="80" y2="5" stroke="#5ec1d8" strokeWidth="2" strokeDasharray="6 3" />
              </svg>
              <span className="text-sm">Overvåkingssone (geofence) — lang stipling</span>
            </div>
            <div className="flex items-center gap-3">
              <svg width="80" height="10" aria-hidden className="shrink-0">
                <line x1="0" y1="5" x2="80" y2="5" stroke="var(--infra)" strokeWidth="2" strokeDasharray="1.5 2 6 2" />
              </svg>
              <span className="text-sm">
                Kabelkorridor (illustrativ) — punkt-strek, sjøkartkonvensjon for kabler
              </span>
            </div>
          </div>
        </section>

        <Separator />

        <section aria-labelledby="ds-components" className="flex flex-col gap-3">
          <h2 id="ds-components" className="text-lg font-medium">
            Komponenter
          </h2>

          <h3 className="mt-2 text-sm font-medium text-muted-foreground">
            Statuspiller
          </h3>
          <div className="flex flex-wrap gap-2 rounded-md border p-4">
            <StatusPill severity="critical" />
            <StatusPill severity="warning" />
            <StatusPill severity="info" />
            <StatusPill severity="ok" label="Normal" />
          </div>

          <h3 className="mt-2 text-sm font-medium text-muted-foreground">
            Hendelsesrad (interaktiv — beslutningen går gjennom samme
            tilstandslager som appen)
          </h3>
          <div className="rounded-md border bg-card p-2">
            <DemoEventRow />
          </div>

          <h3 className="mt-2 text-sm font-medium text-muted-foreground">
            Beslutningshandlinger
          </h3>
          <div className="flex flex-col gap-3 rounded-md border p-4">
            <DecisionActions
              event={{ ...SAMPLE_EVENT, id: "demo:actions", decision: "none", decidedAt: null }}
            />
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              Hurtigtaster i listen:
              <span className="inline-flex items-center gap-1"><Kbd>B</Kbd> bekreft</span>
              <span className="inline-flex items-center gap-1"><Kbd>X</Kbd> avvis</span>
              <span className="inline-flex items-center gap-1"><Kbd>E</Kbd> eskaler</span>
              <span className="inline-flex items-center gap-1"><Kbd>U</Kbd> angre</span>
            </div>
          </div>

          <h3 className="mt-2 text-sm font-medium text-muted-foreground">
            Knapper
          </h3>
          <div className="flex flex-wrap items-center gap-2 rounded-md border p-4">
            <Button>Primær</Button>
            <Button variant="secondary">Sekundær</Button>
            <Button variant="outline">Omriss</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destruktiv</Button>
          </div>
        </section>

        <footer className="pb-6 text-xs text-muted-foreground">
          Designsystemet leser tokens direkte fra appens CSS — endres et token,
          endres både appen og denne siden.
        </footer>
      </div>
    </div>
  );
}

function MarkerSample({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-2">
      {children}
      <span className="text-center text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
