# Varde

Maritime situational-awareness HMI prototype — a decision-support interface for
monitoring vessel traffic in the inner Oslofjord. Built around real AIS data
from Kystverket via BarentsWatch, with a deterministic scenario mode for demos.

The UX thesis: a scene with hundreds of vessels is useless if everything has
equal weight. The job of the interface is to answer one question fast — *which
vessel needs a decision right now, and why?*

**[Live demo](https://varde-silk.vercel.app)** · **[Case study](https://varde-silk.vercel.app/case)** · **[Design system](https://varde-silk.vercel.app/design-system)**

> Portfolio piece, built solo. The event/anomaly logic is deliberately simple
> and clearly labelled where illustrative; this is a UX exploration, not an
> operational or tested system.

## Stack

Next.js (App Router) · TypeScript · Tailwind · shadcn/ui · MapLibre GL with
Kartverket sjøkart basemap · zustand · Geist.

## Running locally

```bash
npm install
npm run dev   # http://localhost:3000 (or next free port)
```

Without API credentials the app runs in **Scenario** mode — a recorded,
deterministic scene that reproduces the full decision-support story offline.

### Live data (optional)

Real AIS requires a BarentsWatch API client
([register here](https://www.barentswatch.no/minside/)). Copy `.env.example` to
`.env.local` and fill in:

```
BARENTSWATCH_CLIENT_ID=your-email@example.com:client-name
BARENTSWATCH_CLIENT_SECRET=...
```

Secrets stay server-side: the browser only ever talks to the `/api/ais` proxy,
which handles OAuth, caching and bounding-box filtering. Never prefix these
`NEXT_PUBLIC_`.

## Deploying to Vercel

Import the repo in Vercel — it builds with zero configuration. To enable live
data, add `BARENTSWATCH_CLIENT_ID` and `BARENTSWATCH_CLIENT_SECRET` as
Environment Variables in the Vercel project settings. Without them the deploy
runs in Scenario mode, which is fully functional.

## What's inside

- **Operational map** — Kartverket sjøkart, heading-aware vessel markers,
  monitoring zones and illustrative cable corridors.
- **Prioritised event queue** — explainable, factor-based scoring; keyboard-first
  triage (K/X/E/U); profiles and search.
- **Contact bottom sheet** — identification-first, with a confirmed-vs-illustrative
  risk profile and live vessel lookup.
- **Decision board** — kanban of decision states; **journal** with operator
  signature and watch-handover export.
- **Threat context** — shadow-fleet (AIS gap/jump) and cable-threat
  (loiter-in-corridor, predicted approach) signatures.
- **Design system** at `/design-system` — tokens, type, components, with live
  WCAG contrast values and the Laws of UX applied.
- **Case study** at `/case` — the design rationale: the two real threats, the
  honesty rules, the explainable scoring, and the ops-room borrowings.

## Data licence

AIS data is from Kystverket via BarentsWatch under NLOD. Small fishing vessels
(≤15 m) and recreational craft (≤45 m) are filtered out of the feed upstream for
privacy. Cable corridors are representative and drawn for the prototype — exact
subsea routes are not public.
