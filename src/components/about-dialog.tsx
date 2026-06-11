"use client";

import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** The honesty note: what is real, what is constructed, and what this is for. */
export function AboutDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Info data-icon="inline-start" aria-hidden />
          Om prototypen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Om denne prototypen</DialogTitle>
          <DialogDescription>
            En UX-utforskning av maritim beslutningsstøtte — bygget alene som
            porteføljeprosjekt.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm leading-relaxed">
          <p>
            <strong>Direktemodus</strong> viser ekte AIS-data fra Kystverket via
            BarentsWatch (NLOD-lisens). Av personvernhensyn er fiskefartøy
            under 15 m og fritidsfartøy under 45 m filtrert ut av kilden.
          </p>
          <p>
            <strong>Scenariomodus</strong> er en konstruert, deterministisk
            avspilling laget for demo: fartøyene, navnene og hendelsene er
            fiktive, men følger realistiske mønstre i Oslofjorden. Avspillingen
            går raskere enn sanntid.
          </p>
          <p>
            <strong>Hendelseslogikken</strong> (AIS-bortfall, AIS-sprang, lav
            fart i sone/korridor, soneinngang) er bevisst enkel og illustrativ.
            Overvåkingssonene er tegnet for prototypen og er ikke offisielle
            områder. Dette er ikke et operativt eller testet system.
          </p>
          <p>
            <strong>Trusselkontekst</strong> bygger på to reelle mønstre i
            norske farvann: skyggeflåtens AIS-manipulasjon og ankerdragging
            over sjøkabler. Kabelkorridorene er representative og tegnet for
            prototypen — eksakte kabeltraseer er bevisst ikke offentlige.
            Prioritetsscoren er en åpen sum av eksplisitte faktorer som vises i
            sin helhet for hver hendelse.
          </p>
          <p>
            <strong>Risikoprofilen</strong> skiller tydelig mellom bekreftede
            data (flaggstat, type og identitet avledet fra AIS) og illustrativ
            berikelse (forsikring, byggeår, sanksjonstreff — kun konstruerte
            demoverdier, aldri for reelle fartøy). «Risikofylt flaggstat» er en
            forenklet liste laget for demoen. Radarkontakten uten AIS er
            illustrativ og viser at datamodellen behandler AIS som én av flere
            mulige kilder.
          </p>
          <p className="text-muted-foreground">
            Terskelverdier, soner, korridorer og scoringsvekter ligger samlet i
            én konfigurasjon og er enkle å justere. Se også{" "}
            <a href="/design-system" className="underline underline-offset-2">
              designsystemet
            </a>
            .
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
