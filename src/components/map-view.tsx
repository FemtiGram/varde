"use client";

import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
import {
  BBOX,
  CORRIDORS,
  MAP_CENTER,
  MAP_DEFAULT_ZOOM,
  THRESHOLDS,
  ZONES,
} from "@/lib/config";
import { useAppStore } from "@/lib/store";
import type { Contact, EventSeverity } from "@/lib/types";
import { shipTypeLabel } from "@/lib/ship-types";
import { vesselGlyphSvg } from "./vessel-marker";

/**
 * Operational map: Kartverket sjøkart raster + infrastructure corridors +
 * monitoring zones + contact markers (AIS and non-AIS through the same path).
 * Markers are plain DOM elements managed imperatively (MapLibre Marker API);
 * React drives them through the store-subscription effect below.
 */

const SJOKART_TILES =
  "https://cache.kartverket.no/v1/wmts/1.0.0/sjokartraster/default/webmercator/{z}/{y}/{x}.png";

const SEVERITY_RANK: Record<EventSeverity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

function ringFeature(
  polygon: [number, number][],
  props: Record<string, string>
): GeoJSON.Feature {
  return {
    type: "Feature",
    properties: props,
    geometry: { type: "Polygon", coordinates: [[...polygon, polygon[0]]] },
  };
}

function polyCentroid(polygon: [number, number][]): [number, number] {
  const lon = polygon.reduce((s, p) => s + p[0], 0) / polygon.length;
  const lat = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;
  return [lon, lat];
}

interface MarkerEntry {
  marker: maplibregl.Marker;
  el: HTMLButtonElement;
  /** Cache of the last-rendered state to avoid needless DOM writes */
  key: string;
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
  const corridorLabelsRef = useRef<maplibregl.Marker[]>([]);
  const lastFocusNonce = useRef(0);

  // Map bootstrap
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      center: MAP_CENTER,
      zoom: MAP_DEFAULT_ZOOM,
      minZoom: 8,
      maxBounds: [
        [BBOX.minLon - 0.35, BBOX.minLat - 0.18],
        [BBOX.maxLon + 0.35, BBOX.maxLat + 0.18],
      ],
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          sjokart: {
            type: "raster",
            tiles: [SJOKART_TILES],
            tileSize: 256,
            attribution: "© Kartverket (sjøkart)",
          },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#1a2027" } },
          {
            id: "sjokart",
            type: "raster",
            source: "sjokart",
            paint: {
              // Soften the light chart slightly so UI chrome stays readable on top
              "raster-brightness-max": 0.88,
              "raster-saturation": -0.15,
            },
          },
        ],
      },
    });

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right"
    );
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );
    map.keyboard.disable(); // app-level keyboard model owns the arrow keys

    map.on("load", () => {
      // Operating area boundary
      map.addSource("bbox", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [BBOX.minLon, BBOX.minLat],
              [BBOX.maxLon, BBOX.minLat],
              [BBOX.maxLon, BBOX.maxLat],
              [BBOX.minLon, BBOX.maxLat],
              [BBOX.minLon, BBOX.minLat],
            ],
          },
        },
      });
      map.addLayer({
        id: "bbox-line",
        type: "line",
        source: "bbox",
        paint: {
          "line-color": "#8a93a6",
          "line-width": 1,
          "line-dasharray": [4, 3],
          "line-opacity": 0.6,
        },
      });

      // Critical infrastructure corridors (illustrative) — magenta dash-dot,
      // visually distinct from the cyan monitoring zones
      map.addSource("corridors", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: CORRIDORS.map((c) =>
            ringFeature(c.polygon, { id: c.id, name: c.name })
          ),
        },
      });
      map.addLayer({
        id: "corridors-fill",
        type: "fill",
        source: "corridors",
        paint: { "fill-color": "#d96bc8", "fill-opacity": 0.07 },
      });
      map.addLayer({
        id: "corridors-line",
        type: "line",
        source: "corridors",
        paint: {
          "line-color": "#d96bc8",
          "line-width": 1.5,
          "line-dasharray": [1.5, 2, 6, 2],
          "line-opacity": 0.8,
        },
      });
      for (const corridor of CORRIDORS) {
        const el = document.createElement("div");
        el.textContent = corridor.name;
        el.setAttribute("aria-hidden", "true");
        el.className = "corridor-label";
        el.style.cssText =
          "font: 500 10px var(--font-geist-mono); letter-spacing: 0.08em; text-transform: uppercase; color: #f0c2e8; background: rgba(34,22,32,0.74); padding: 2px 6px; border: 1px dashed rgba(217,107,200,0.55); border-radius: 3px; pointer-events: none;";
        corridorLabelsRef.current.push(
          new maplibregl.Marker({ element: el, anchor: "center" })
            .setLngLat(polyCentroid(corridor.polygon))
            .addTo(map)
        );
      }

      // Monitoring zones
      map.addSource("zones", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: ZONES.map((z) =>
            ringFeature(z.polygon, { id: z.id, name: z.name })
          ),
        },
      });
      map.addLayer({
        id: "zones-fill",
        type: "fill",
        source: "zones",
        paint: { "fill-color": "#5ec1d8", "fill-opacity": 0.08 },
      });
      map.addLayer({
        id: "zones-line",
        type: "line",
        source: "zones",
        paint: {
          "line-color": "#5ec1d8",
          "line-width": 1.5,
          "line-dasharray": [6, 3],
          "line-opacity": 0.7,
        },
      });
      for (const zone of ZONES) {
        const el = document.createElement("div");
        el.textContent = zone.name;
        el.setAttribute("aria-hidden", "true");
        el.style.cssText =
          "font: 500 10px var(--font-geist-mono); letter-spacing: 0.08em; text-transform: uppercase; color: #bfe8f2; background: rgba(20,28,34,0.72); padding: 2px 6px; border: 1px solid rgba(94,193,216,0.45); border-radius: 3px; pointer-events: none;";
        new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat(polyCentroid(zone.polygon))
          .addTo(map);
      }

      // Selected contact's recent track
      map.addSource("track", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "track-line",
        type: "line",
        source: "track",
        paint: {
          "line-color": "#7fd6e8",
          "line-width": 1.5,
          "line-opacity": 0.85,
        },
      });
    });

    // Click on open water clears the selection
    map.on("click", () => useAppStore.getState().selectContact(null));

    mapRef.current = map;
    const markers = markersRef.current;
    return () => {
      map.remove();
      mapRef.current = null;
      markers.clear();
      corridorLabelsRef.current = [];
    };
  }, []);

  // Store subscription: sync markers, layers, track line and focus with app state
  useEffect(() => {
    const sync = () => {
      const map = mapRef.current;
      if (!map) return;
      const {
        contacts,
        events,
        selectedContactId,
        focusNonce,
        nowMs,
        showInfrastructure,
      } = useAppStore.getState();

      // Infrastructure layer visibility
      const infraVisibility = showInfrastructure ? "visible" : "none";
      for (const layerId of ["corridors-fill", "corridors-line"]) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, "visibility", infraVisibility);
        }
      }
      for (const label of corridorLabelsRef.current) {
        label.getElement().style.display = showInfrastructure ? "" : "none";
      }

      // Highest undismissed severity per contact
      const severityByContact = new Map<string, EventSeverity>();
      for (const e of events) {
        if (e.decision === "dismissed") continue;
        const current = severityByContact.get(e.contactId);
        if (!current || SEVERITY_RANK[e.severity] > SEVERITY_RANK[current]) {
          severityByContact.set(e.contactId, e.severity);
        }
      }

      const markers = markersRef.current;
      const seen = new Set<string>();

      for (const contact of Object.values(contacts)) {
        seen.add(contact.id);
        const severity = severityByContact.get(contact.id) ?? null;
        const selected = contact.id === selectedContactId;
        const moving =
          (contact.latest.speedOverGround ?? 0) >
          THRESHOLDS.stationaryMaxSpeedKnots;
        const heading =
          contact.latest.trueHeading ?? contact.latest.courseOverGround;
        const stale =
          nowMs - new Date(contact.latest.msgtime).getTime() >
          THRESHOLDS.aisGapMinutes * 60_000;
        const isSensor = contact.source !== "ais";
        // Non-AIS contacts are always labelled — they are the signal
        const showLabel = Boolean(severity) || selected || isSensor;
        const name =
          contact.name ?? (isSensor ? "UKJENT KONTAKT" : String(contact.mmsi));
        const key = [
          severity,
          selected,
          moving,
          heading == null ? "" : Math.round(heading),
          stale,
          showLabel,
          name,
        ].join("|");

        let entry = markers.get(contact.id);
        if (!entry) {
          const el = document.createElement("button");
          el.type = "button";
          el.className = "vessel-marker";
          el.style.cssText =
            "background: none; border: none; padding: 0; display: flex; flex-direction: column; align-items: center; gap: 1px;";
          el.addEventListener("click", (ev) => {
            ev.stopPropagation();
            useAppStore.getState().selectContact(contact.id);
          });
          const marker = new maplibregl.Marker({ element: el, anchor: "center" })
            .setLngLat([contact.latest.longitude, contact.latest.latitude])
            .addTo(map);
          entry = { marker, el, key: "" };
          markers.set(contact.id, entry);
        } else {
          entry.marker.setLngLat([
            contact.latest.longitude,
            contact.latest.latitude,
          ]);
        }

        if (entry.key !== key) {
          entry.key = key;
          const glyph = vesselGlyphSvg({
            source: contact.source,
            moving,
            headingDeg: heading,
            severity,
            selected,
            size: severity || selected || isSensor ? 30 : 24,
          });
          const label = showLabel
            ? `<span style="font: 500 10px var(--font-geist-mono); color: ${
                selected ? "var(--selection-token)" : "var(--foreground)"
              }; background: rgba(20,28,34,0.78); padding: 1px 5px; border-radius: 3px; white-space: nowrap;${
                isSensor ? "border: 1px dashed var(--contact-unknown);" : ""
              }">${name}</span>`
            : "";
          entry.el.innerHTML = `<span style="opacity:${stale && !isSensor ? 0.45 : 1}; display:block; line-height:0;">${glyph}</span>${label}`;
          entry.el.setAttribute(
            "aria-label",
            isSensor
              ? `Ukjent kontakt uten AIS, ${contact.sourceLabel}`
              : `${name}, ${shipTypeLabel(contact.shipType)}${
                  severity ? ", aktiv hendelse" : ""
                }`
          );
          // Event/selected/sensor contacts sit above background traffic
          entry.el.style.zIndex = severity || selected || isSensor ? "3" : "1";
        }
      }

      // Remove markers for contacts no longer in scope
      for (const [id, entry] of markers) {
        if (!seen.has(id)) {
          entry.marker.remove();
          markers.delete(id);
        }
      }

      // Selected contact track line
      const trackSource = map.getSource("track") as
        | maplibregl.GeoJSONSource
        | undefined;
      if (trackSource) {
        const selected: Contact | undefined =
          selectedContactId != null ? contacts[selectedContactId] : undefined;
        trackSource.setData(
          selected && selected.track.length > 1
            ? {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: selected.track.map((p) => [
                    p.longitude,
                    p.latitude,
                  ]),
                },
              }
            : { type: "FeatureCollection", features: [] }
        );
      }

      // List/drawer-driven focus
      if (focusNonce !== lastFocusNonce.current) {
        lastFocusNonce.current = focusNonce;
        const target =
          selectedContactId != null ? contacts[selectedContactId] : undefined;
        if (target) {
          map.easeTo({
            center: [target.latest.longitude, target.latest.latitude],
            zoom: Math.max(map.getZoom(), 11.5),
            duration: 600,
          });
        }
      }
    };

    const unsubscribe = useAppStore.subscribe(sync);
    const map = mapRef.current;
    if (map) {
      if (map.loaded()) sync();
      else map.once("load", sync);
    }
    return unsubscribe;
  }, []);

  return (
    <div
      ref={containerRef}
      className="size-full"
      role="application"
      aria-label="Operasjonskart med kontakter, overvåkingssoner og infrastrukturkorridorer"
    />
  );
}
