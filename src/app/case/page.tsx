import Link from "next/link";
import { ArrowLeft, Code2, ExternalLink } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Varde — Om prosjektet (case study)",
  description:
    "Designrasjonale bak Varde: en prototyp for maritim situasjonsforståelse og beslutningsstøtte.",
};

/**
 * Case study: the design rationale behind Varde. Static server component —
 * the document that carries the "why" so the operational UI can stay clean.
 */
export default function CasePage() {
  return (
    <div className="h-dvh overflow-y-auto bg-background">
      <article className="mx-auto flex max-w-3xl flex-col gap-12 px-6 py-12">
        <header className="flex flex-col gap-4">
          <Link
            href="/"
            className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Tilbake til operasjonsbildet
          </Link>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-semibold tracking-[0.3em] text-primary">
              VARDE
            </span>
            <span className="text-sm text-muted-foreground">· case study</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Å vise det ene fartøyet som krever en beslutning
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Varde er en prototyp for maritim situasjonsforståelse — et
            grensesnitt som hjelper en operatør å se hvilket fartøy som trenger
            oppmerksomhet akkurat nå, og hvorfor. Bygget rundt ekte AIS-data fra
            Kystverket via BarentsWatch, med en deterministisk scenariomodus for
            demo.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Tag>Bygget alene</Tag>
            <Tag>Ekte AIS-data (NLOD)</Tag>
            <Tag>Next.js · MapLibre · shadcn/ui</Tag>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <LinkButton href="https://varde-silk.vercel.app" external>
              <ExternalLink aria-hidden className="size-4" />
              Live demo
            </LinkButton>
            <LinkButton href="https://github.com/FemtiGram/varde" external>
              <Code2 aria-hidden className="size-4" />
              Kildekode
            </LinkButton>
            <LinkButton href="/design-system">Designsystem</LinkButton>
          </div>
          <p className="rounded-md border border-dashed border-status-warning/40 bg-status-warning/5 p-3 text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-status-warning">
              Ærlighet først:
            </span>{" "}
            dette er en UX-utforskning, ikke et operativt eller testet system.
            Hendelseslogikken er bevisst enkel, og alt som er konstruert er
            tydelig merket. Mer om det lenger ned.
          </p>
        </header>

        <Section title="Problemet" id="problem">
          <p>
            Et kart med hundrevis av fartøy er ubrukelig hvis alt har lik vekt.
            Den virkelige jobben til et overvåkingsgrensesnitt er ikke å vise all
            trafikken — det er å svare på ett spørsmål, raskt:{" "}
            <em>hvilket fartøy krever en beslutning nå, og hvorfor?</em>
          </p>
          <p>
            Det er signal mot støy. Et AIS-bortfall midt i åpent hav er støy. Det
            samme bortfallet rett ved en sjøkabel, fra et fartøy med en risikabel
            profil, er nettopp det en operatør må handle på. Hele prototypen er
            organisert rundt å skille de to.
          </p>
        </Section>

        <Section title="To reelle trusler som driver designet" id="trusler">
          <p>
            Designet er forankret i to faktiske mønstre i norske farvann. De er
            grunnen til at konteksten — ikke bare hendelsen — avgjør prioritet.
          </p>
          <Threat title="Skyggeflåtens AIS-manipulasjon">
            Sanksjonerte tankskip seiler gjennom norske farvann og slår av eller
            forfalsker AIS for å unngå sporing. Signalet er et fartøy som blir
            mørkt, eller som hopper til en posisjon det fysisk ikke kan ha nådd —
            særlig nær sensitive områder.
          </Threat>
          <Threat title="Ankerdragging mot sjøkabler">
            Det gjentatte mønsteret er et handelsfartøy som senker farten og
            drar ankeret over havbunnen, kutter kabler, og der attribusjon i
            ettertid er nær umulig. Signalet er vedvarende lav fart pluss et spor
            som krysser en kabelkorridor.
          </Threat>
          <p>
            Begge har samme designimplikasjon:{" "}
            <strong className="text-foreground">
              beslutningsvinduet er til sjøs, i sanntid, hos operatøren.
            </strong>{" "}
            Det er verdien Varde demonstrerer.
          </p>
        </Section>

        <Section title="Beslutningsryggraden" id="ryggrad">
          <p>
            Alt henger på én flyt:{" "}
            <strong className="text-foreground">
              prioritert kø → identifikasjon → beslutning → journal.
            </strong>
          </p>
          <ol className="flex flex-col gap-3">
            <Step n={1} title="Køen rangerer">
              Hendelser sorteres etter en forklarbar prioritetsscore, høyest
              først. Toppen av listen er alltid svaret på «hva trenger meg nå?».
              Fullt tastaturstyrt: piltaster navigerer, K/X/E avgjør, og hver
              beslutning flytter fokus til neste åpne hendelse — som en innboks.
            </Step>
            <Step n={2} title="Panelet identifiserer">
              Å velge en hendelse åpner et bunnpanel som leses
              identifikasjon-først: hvem er dette, hvilken kilde, hvor mye kan
              jeg stole på det — før vurderingen og beslutningen.
            </Step>
            <Step n={3} title="Operatøren tar stilling">
              Tre eksplisitte valg: kvitter, avvis, eskaler. Aldri flere. Den
              visuelt primære knappen følger det scoringen konkluderte med —
              eskaler for kritiske, kvitter ellers — uten å skjule alternativene.
            </Step>
            <Step n={4} title="Journalen husker">
              Hver beslutning og angring logges med tidsstempel og
              operatørsignatur. Vaktjournalen er det som overlever når
              arbeidstilstanden ryddes — og grunnlaget for en vaktoverlevering.
            </Step>
          </ol>
        </Section>

        <Section title="Forklarbar prioritering, ikke en svart boks" id="score">
          <p>
            En operatør (og en intervjuer) skal kunne peke på hvorfor noe rangerer
            der det gjør. Prioritetsscoren er derfor en{" "}
            <strong className="text-foreground">
              ren sum av eksplisitte faktorer
            </strong>
            : grunnscore for hendelsestypen, nærhet til infrastruktur,
            risikoprofil, atferdsmønster, ferskhet. Hele regnestykket ligger bak
            selve tallet — ett klikk unna, aldri påtvunget.
          </p>
          <p>
            Vektene bor i én konfigurasjonsfil. Det gjør modellen lett å forklare
            og lett å justere — og holder den ærlig: ingenting er skjult i
            uleselig logikk.
          </p>
        </Section>

        <Section title="Ærlighet som funksjon" id="aerlighet">
          <p>
            Et portefølje­prosjekt som later som det har etterretning det ikke
            har, er verdiløst. Varde trekker en hard, synlig grense mellom det
            som er ekte og det som er illustrativt:
          </p>
          <ul className="flex flex-col gap-2">
            <Honest real>
              <strong className="text-foreground">Bekreftet</strong> — posisjon,
              fart, kurs, identitet og flaggstat er avledet fra AIS. Vises som
              ekte.
            </Honest>
            <Honest>
              <strong className="text-foreground">Illustrativt</strong> —
              forsikring, byggeår og sanksjonstreff finnes ikke i AIS og har
              ingen åpen kilde her. De finnes kun for konstruerte demofartøy, og
              er alltid tydelig merket. For reelle fartøy konstrueres de aldri.
            </Honest>
            <Honest>
              <strong className="text-foreground">Konstruerte aktører</strong> —
              trusselfartøyene er fiktive. Reelle navn (som Bastø-fergene) brukes
              bare der den viste atferden er deres faktiske, daglige atferd.
              Reelle identiteter knyttes aldri til konstruert trusselatferd.
            </Honest>
          </ul>
          <p>
            Panelet skiller dette visuelt med egne, merkede seksjoner — og
            kabelkorridorene er representative, fordi eksakte kabeltraseer
            bevisst ikke er offentlige. Det er i seg selv en del av den operative
            virkeligheten.
          </p>
        </Section>

        <Section title="Designet for operatøren" id="operator">
          <p>
            Mye er lånt — bevisst — fra systemer og spill som allerede har løst
            lesbarhet under press:
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Borrow source="Flygeleder­radar (ATC)">
              Blink betyr én ting: en ukvittert kritisk hendelse. Kvitteringen
              stopper blinkingen. Klokken går i UTC (Z-tid).
            </Borrow>
            <Borrow source="Alarmhåndtering (EEMUA 191)">
              En hendelsesflom-måler: for mange nye hendelser per vindu betyr at
              systemet, ikke operatøren, er problemet.
            </Borrow>
            <Borrow source="Marine systemer (CMO/sjøkart)">
              Mørke fartøy vises som hule «ghost»-markører på sist kjente
              posisjon med tidsstempel. Mål-verktøy for peiling og avstand
              (EBL/VRM). Kursfremskriving mot infrastruktur (CPA).
            </Borrow>
            <Borrow source="EVE Online (overview)">
              Navngitte profiler som skjærer hendelsesbildet for en vaktoppgave
              («Kabelvakt», «Mørke fartøy»), med levende tellere.
            </Borrow>
          </div>
          <p>
            Språket er operatørens, ikke generisk UI: en hendelse{" "}
            <em>kvitteres</em> (alarmkvittering), loggen er en{" "}
            <em>vaktjournal</em>. Ord en kontrollromsoperatør allerede har
            muskelminne for.
          </p>
        </Section>

        <Section title="Det visuelle systemet" id="visuelt">
          <p>
            Mørkt er ikke en preferanse her — det er en domenebeslutning (dempede
            kontrollrom, nattevakter). Resten følger noen få regler:
          </p>
          <ul className="flex flex-col gap-2">
            <Bullet>
              <strong className="text-foreground">Styrkeregel:</strong> bare
              alvorsgrad og beslutningsknapper får være «høye». Alt annet er
              dempet tekst, så operatøren kan skille alarm fra attributt.
            </Bullet>
            <Bullet>
              <strong className="text-foreground">Farge er funksjonell</strong>{" "}
              og alltid paret med form, ikon eller tekst — mening overlever uten
              fargesyn. Pil = i fart, sirkel = kontakt uten AIS, hul kontur =
              mørkt fartøy.
            </Bullet>
            <Bullet>
              <strong className="text-foreground">WCAG måles, ikke gjettes.</strong>{" "}
              Et skript regner kontrast for hvert token mot riktig bakgrunn — og
              for kartoverlegg mot selve sjøkartet, ikke UI-flaten.
            </Bullet>
            <Bullet>
              <strong className="text-foreground">Kantprinsippet:</strong> lyse
              aksenter (sporlinje, seleksjon) berører aldri det lyse sjøkartet
              direkte — en mørk kant bærer kontrasten.
            </Bullet>
          </ul>
        </Section>

        <Section title="Arkitektur" id="arkitektur">
          <p>
            Datamodellen er kildeagnostisk: AIS er én kilde blant flere. Hver
            posisjonsmelding bærer sin kilde, så en radar-, satellitt- eller
            undervannssensor kan mate samme pipeline uten omskriving. Den ene
            illustrative radarkontakten beviser nettopp dette.
          </p>
          <ul className="flex flex-col gap-2">
            <Bullet>
              En tynn server-proxy håndterer OAuth, caching og avgrensning mot
              BarentsWatch. Hemmeligheter forlater aldri serveren — nettleseren
              snakker bare med <code className="font-mono text-xs">/api/ais</code>.
            </Bullet>
            <Bullet>
              Hendelsesavledning er ren og tilstandsløs; operatørens beslutninger
              legges oppå via stabile id-er, så ny avledning aldri visker ut en
              beslutning.
            </Bullet>
            <Bullet>
              Scenariomodus er deterministisk — fartøy følger skriptede ruter,
              verifisert til å ligge på vann mot kartfliser — så
              beslutningshistorien spilles av likt hver gang.
            </Bullet>
          </ul>
        </Section>

        <Section title="Hva som bevisst er utenfor" id="scope">
          <p>
            Like viktig som det som er bygget: det som er valgt bort, og hvorfor.
          </p>
          <ul className="flex flex-col gap-2">
            <Bullet>
              <strong className="text-foreground">Innlogging og roller</strong> —
              kontrollrommets praksis med vakt-initialer gir ansvarlighet uten en
              full auth-stack. Ekte fler­bruker er en senere skive.
            </Bullet>
            <Bullet>
              <strong className="text-foreground">Lyst tema</strong> — token-laget
              gjør det strukturelt billig senere, men hvert WCAG-løfte er målt mot
              den mørke paletten. Vi valgte å ikke bruke kontrast-budsjettet her.
            </Bullet>
            <Bullet>
              <strong className="text-foreground">
                Ekte multi-sensor og responsutsending
              </strong>{" "}
              — én illustrativ ikke-AIS-kontakt viser at modellen er klar; ekte
              radar/satellitt og patrulje­tildeling er neste skiver.
            </Bullet>
          </ul>
        </Section>

        <footer className="flex flex-col gap-3 border-t pt-6 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Kolofon.</strong> Next.js
            (App Router), TypeScript, Tailwind, shadcn/ui, MapLibre GL med
            Kartverkets sjøkart, zustand, Geist. AIS-data fra Kystverket via
            BarentsWatch under NLOD; fiskefartøy ≤15 m og fritidsfartøy ≤45 m er
            filtrert ut av kilden av personvernhensyn. Bygget alene som
            portefølje­prosjekt.
          </p>
          <Link
            href="/"
            className="flex w-fit items-center gap-1.5 underline-offset-4 hover:underline"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Tilbake til operasjonsbildet
          </Link>
        </footer>
      </article>
    </div>
  );
}

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="flex flex-col gap-4 text-base leading-relaxed text-muted-foreground [&_strong]:font-medium">
        {children}
      </div>
    </section>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

function LinkButton({
  href,
  external = false,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const className =
    "flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function Threat({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border-l-2 border-status-critical/60 bg-card px-4 py-3">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-card font-mono text-sm font-semibold text-primary">
        {n}
      </span>
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-0.5 text-sm leading-relaxed">{children}</p>
      </div>
    </li>
  );
}

function Borrow({ source, children }: { source: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <h3 className="text-sm font-semibold text-foreground">{source}</h3>
      <p className="mt-1 text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function Honest({
  real = false,
  children,
}: {
  real?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2">
      <span
        aria-hidden
        className={`mt-1.5 size-2 shrink-0 rounded-[2px] ${
          real ? "bg-status-ok" : "bg-status-warning"
        }`}
      />
      <span className="text-sm leading-relaxed">{children}</span>
    </li>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
