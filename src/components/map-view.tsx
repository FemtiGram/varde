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
import { bearingDegrees, haversineMetres, projectPosition } from "@/lib/geo";
import { useAppStore } from "@/lib/store";
import type { Contact, EventSeverity } from "@/lib/types";
import { projectedCorridorEntry } from "@/lib/events";
import { formatClockShort } from "@/lib/format";
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
  const measuring = useAppStore((s) => s.measuring);
  /** Set while measure mode is active so marker clicks snap the EBL to vessels */
  const measureClickRef = useRef<((lngLat: [number, number]) => void) | null>(null);
  const interceptMarkerRef = useRef<maplibregl.Marker | null>(null);

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
        paint: { "fill-color": "#b53f9e", "fill-opacity": 0.09 },
      });
      map.addLayer({
        id: "corridors-line",
        type: "line",
        source: "corridors",
        paint: {
          "line-color": "#b53f9e",
          "line-width": 1.8,
          "line-dasharray": [1.5, 2, 6, 2],
          "line-opacity": 0.95,
        },
      });
      for (const corridor of CORRIDORS) {
        const el = document.createElement("div");
        el.textContent = corridor.name;
        el.setAttribute("aria-hidden", "true");
        el.className = "corridor-label";
        el.style.cssText =
          "font: 500 12px var(--font-geist-mono); letter-spacing: 0.08em; text-transform: uppercase; color: #f0c2e8; background: rgba(34,22,32,0.74); padding: 2px 6px; border: 1px dashed rgba(217,107,200,0.55); border-radius: 3px; pointer-events: none;";
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
        paint: { "fill-color": "#2f8fa6", "fill-opacity": 0.1 },
      });
      map.addLayer({
        id: "zones-line",
        type: "line",
        source: "zones",
        paint: {
          "line-color": "#2f8fa6",
          "line-width": 1.8,
          "line-dasharray": [6, 3],
          "line-opacity": 0.9,
        },
      });
      for (const zone of ZONES) {
        const el = document.createElement("div");
        el.textContent = zone.name;
        el.setAttribute("aria-hidden", "true");
        el.style.cssText =
          "font: 500 12px var(--font-geist-mono); letter-spacing: 0.08em; text-transform: uppercase; color: #bfe8f2; background: rgba(20,28,34,0.72); padding: 2px 6px; border: 1px solid rgba(94,193,216,0.45); border-radius: 3px; pointer-events: none;";
        new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat(polyCentroid(zone.polygon))
          .addTo(map);
      }

      // Highlight overlays for the zone/corridor implicated by the selected
      // event (filter swapped in the sync pass)
      map.addLayer({
        id: "zones-highlight",
        type: "line",
        source: "zones",
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": "#2f8fa6", "line-width": 3.5, "line-opacity": 1 },
      });
      map.addLayer({
        id: "corridors-highlight",
        type: "line",
        source: "corridors",
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": "#b53f9e", "line-width": 3.5, "line-opacity": 1 },
      });

      // EBL/VRM measure tool geometry
      map.addSource("measure", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "measure-line",
        type: "line",
        source: "measure",
        filter: ["==", ["get", "kind"], "ebl"],
        paint: {
          "line-color": "#1d2630",
          "line-width": 2,
          "line-dasharray": [4, 3],
        },
      });
      map.addLayer({
        id: "measure-ring",
        type: "line",
        source: "measure",
        filter: ["==", ["get", "kind"], "vrm"],
        paint: {
          "line-color": "#1d2630",
          "line-width": 1.2,
          "line-dasharray": [2, 2],
          "line-opacity": 0.8,
        },
      });

      // Projected course vector (dead reckoning) for the selected contact
      map.addSource("projection", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "projection-line",
        type: "line",
        source: "projection",
        paint: {
          "line-color": "#2a3340",
          "line-width": 1.8,
          "line-dasharray": [2, 2],
          "line-opacity": 0.9,
        },
      });

      // Selected contact's recent track
      map.addSource("track", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      // Casing first: the bright trail alone is ~1.7:1 against the light
      // chart water; the dark edge supplies the WCAG 1.4.11 contrast boundary
      map.addLayer({
        id: "track-line-casing",
        type: "line",
        source: "track",
        paint: {
          "line-color": "#10181f",
          "line-width": 4.5,
          "line-opacity": 0.9,
        },
      });
      map.addLayer({
        id: "track-line",
        type: "line",
        source: "track",
        paint: {
          "line-color": "#7fd6e8",
          "line-width": 2,
          "line-opacity": 1,
        },
      });
    });

    // Click on open water clears the selection (suspended in measure mode)
    map.on("click", () => {
      if (useAppStore.getState().measuring) return;
      useAppStore.getState().selectContact(null);
    });

    mapRef.current = map;
    const markers = markersRef.current;
    return () => {
      map.remove();
      mapRef.current = null;
      markers.clear();
      corridorLabelsRef.current = [];
    };
  }, []);

  // EBL/VRM measure mode: click sets origin, cursor reads bearing/range,
  // second click pins, Esc exits. M toggles (wired in the layers panel too).
  useEffect(() => {
    const maybeMap = mapRef.current;
    if (!maybeMap || !measuring) return;
    const map: maplibregl.Map = maybeMap;

    let origin: [number, number] | null = null;
    let pinned = false;
    const readout = document.createElement("div");
    readout.style.cssText =
      "font: 600 12px var(--font-geist-mono); color: var(--foreground); background: rgba(20,28,34,0.88); padding: 2px 6px; border-radius: 3px; border: 1px solid var(--border); pointer-events: none; white-space: nowrap;";
    const readoutMarker = new maplibregl.Marker({
      element: readout,
      anchor: "left",
      offset: [14, 0],
    });
    let readoutAdded = false;

    const source = () =>
      map.getSource("measure") as maplibregl.GeoJSONSource | undefined;

    function render(cursor: [number, number]) {
      if (!origin) return;
      const distNm =
        haversineMetres(origin, cursor) / 1852;
      const brg = bearingDegrees(origin, cursor);
      // VRM ring: 64-point circle at the measured range
      const ring: [number, number][] = [];
      for (let i = 0; i <= 64; i++) {
        ring.push(
          projectPosition(origin[0], origin[1], (i / 64) * 360, distNm)
        );
      }
      source()?.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { kind: "ebl" },
            geometry: { type: "LineString", coordinates: [origin, cursor] },
          },
          {
            type: "Feature",
            properties: { kind: "vrm" },
            geometry: { type: "LineString", coordinates: ring },
          },
        ],
      });
      readout.textContent = `${String(Math.round(brg)).padStart(3, "0")}° · ${distNm.toFixed(2)} nm`;
      readoutMarker.setLngLat(cursor);
      if (!readoutAdded) {
        readoutMarker.addTo(map);
        readoutAdded = true;
      }
    }

    function handleClick(lngLat: [number, number]) {
      if (!origin || pinned) {
        // first click, or starting over after a pinned measurement
        origin = lngLat;
        pinned = false;
        source()?.setData({ type: "FeatureCollection", features: [] });
        if (readoutAdded) {
          readoutMarker.remove();
          readoutAdded = false;
        }
        return;
      }
      pinned = true;
      render(lngLat);
    }

    const onClick = (e: maplibregl.MapMouseEvent) =>
      handleClick([e.lngLat.lng, e.lngLat.lat]);
    const onMove = (e: maplibregl.MapMouseEvent) => {
      if (origin && !pinned) render([e.lngLat.lng, e.lngLat.lat]);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") useAppStore.getState().setMeasuring(false);
    };

    measureClickRef.current = handleClick;
    map.on("click", onClick);
    map.on("mousemove", onMove);
    window.addEventListener("keydown", onKey);
    map.getCanvas().style.cursor = "crosshair";

    return () => {
      measureClickRef.current = null;
      map.off("click", onClick);
      map.off("mousemove", onMove);
      window.removeEventListener("keydown", onKey);
      map.getCanvas().style.cursor = "";
      readoutMarker.remove();
      source()?.setData({ type: "FeatureCollection", features: [] });
    };
  }, [measuring]);

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
        mapGreyscale,
        sheetHeight,
      } = useAppStore.getState();

      // Light up the zone/corridor named by the selected event, so the
      // threat-to-asset link is visible, not just described in text
      const selectedEvent = events.find(
        (e) => e.id === useAppStore.getState().selectedEventId
      );
      const hlId = selectedEvent?.zoneId ?? "";
      for (const layerId of ["zones-highlight", "corridors-highlight"]) {
        if (map.getLayer(layerId)) {
          map.setFilter(layerId, ["==", ["get", "id"], hlId]);
        }
      }

      // Spotlight: while a contact is selected, background traffic steps back
      map.getContainer().classList.toggle(
        "map-has-selection",
        selectedContactId != null
      );

      // Basemap greyscale: a fully desaturated chart lets markers, zones and
      // corridors carry all the colour
      if (map.getLayer("sjokart")) {
        map.setPaintProperty(
          "sjokart",
          "raster-saturation",
          mapGreyscale ? -1 : -0.15
        );
        map.setPaintProperty("sjokart", "raster-contrast", mapGreyscale ? 0.05 : 0);
      }

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

      // Highest undismissed severity per contact + alarm state: a critical
      // event nobody has seen or decided blinks (ATC alarm discipline)
      const seenEvents = useAppStore.getState().seenEvents;
      const severityByContact = new Map<string, EventSeverity>();
      const alarmContacts = new Set<string>();
      for (const e of events) {
        if (e.decision === "dismissed") continue;
        const current = severityByContact.get(e.contactId);
        if (!current || SEVERITY_RANK[e.severity] > SEVERITY_RANK[current]) {
          severityByContact.set(e.contactId, e.severity);
        }
        if (e.severity === "critical" && e.decision === "none" && !seenEvents[e.id]) {
          alarmContacts.add(e.contactId);
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
        const alarm = alarmContacts.has(contact.id);
        // A stale AIS contact renders as a ghost at last known position
        const ghost = stale && !isSensor;
        // Signal contacts are always labelled; zoomed in far enough that
        // there is room, everyone gets a quiet green tag (chart-plotter style)
        const zoomLabels = map.getZoom() >= THRESHOLDS.labelAllZoom;
        const isSignal = Boolean(severity) || selected || isSensor || ghost;
        const showLabel = isSignal || zoomLabels;
        const baseName =
          contact.name ?? (isSensor ? "UKJENT KONTAKT" : String(contact.mmsi));
        const name = ghost
          ? `${baseName} · LKP ${formatClockShort(contact.latest.msgtime)}`
          : baseName;
        const key = [
          severity,
          selected,
          moving,
          heading == null ? "" : Math.round(heading),
          stale,
          alarm,
          showLabel,
          isSignal,
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
            if (useAppStore.getState().measuring && measureClickRef.current) {
              const ll = entry!.marker.getLngLat();
              measureClickRef.current([ll.lng, ll.lat]);
              return;
            }
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
          entry.el.classList.toggle("vessel-marker--selected", selected);
          const glyph = vesselGlyphSvg({
            source: contact.source,
            moving,
            headingDeg: heading,
            severity,
            selected,
            ghost,
            size: selected ? 36 : severity || isSensor ? 30 : 24,
          });
          const label = showLabel
            ? `<span style="font: ${selected ? 600 : 500} 12px var(--font-geist-mono); ${
                selected
                  ? "color: var(--background); background: var(--selection-token); box-shadow: 0 0 0 1.5px rgba(16,21,28,0.85);"
                  : isSignal
                    ? "color: var(--foreground); background: rgba(20,28,34,0.85);"
                    : "color: var(--contact-ais); background: rgba(20,28,34,0.78);"
              } padding: 1px 5px; border-radius: 3px; white-space: nowrap;${
                isSensor && !selected ? "border: 1px dashed var(--contact-unknown);" : ""
              }">${name}</span>`
            : "";
          const ping = selected ? `<span class="vessel-ping" aria-hidden="true"></span>` : "";
          entry.el.innerHTML = `<span class="${alarm ? "alarm-blink" : ""}" style="position:relative; opacity:${ghost ? 0.85 : 1}; display:block; line-height:0;">${ping}${glyph}</span>${label}`;
          entry.el.setAttribute(
            "aria-label",
            isSensor
              ? `Ukjent kontakt uten AIS, ${contact.sourceLabel}`
              : `${name}, ${shipTypeLabel(contact.shipType)}${
                  severity ? ", aktiv hendelse" : ""
                }`
          );
          // Selected stacks above all, incl. zone/corridor labels; then
          // event/sensor contacts, then background traffic
          entry.el.style.zIndex = selected ? "6" : severity || isSensor ? "3" : "1";
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

      // Projection vector: where is the selected contact heading?
      const projSource = map.getSource("projection") as
        | maplibregl.GeoJSONSource
        | undefined;
      if (projSource) {
        const sel =
          selectedContactId != null ? contacts[selectedContactId] : undefined;
        const sog = sel?.latest.speedOverGround ?? null;
        const course =
          sel?.latest.courseOverGround ?? sel?.latest.trueHeading ?? null;
        projSource.setData(
          sel && sog != null && course != null && sog >= THRESHOLDS.projectionMinSpeedKnots
            ? {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [sel.latest.longitude, sel.latest.latitude],
                    projectPosition(
                      sel.latest.longitude,
                      sel.latest.latitude,
                      course,
                      (sog * THRESHOLDS.projectionHorizonMinutes) / 60
                    ),
                  ],
                },
              }
            : { type: "FeatureCollection", features: [] }
        );
      }

      // Predicted intercept: ✕ where the selected contact's projection first
      // enters a corridor, labelled with time-to-entry
      {
        const sel =
          selectedContactId != null ? contacts[selectedContactId] : undefined;
        const sog = sel?.latest.speedOverGround ?? null;
        const course =
          sel?.latest.courseOverGround ?? sel?.latest.trueHeading ?? null;
        const entry =
          sel && sog != null && course != null && sog >= THRESHOLDS.projectionMinSpeedKnots
            ? projectedCorridorEntry(
                sel.latest.longitude,
                sel.latest.latitude,
                course,
                sog
              )
            : null;
        if (entry) {
          if (!interceptMarkerRef.current) {
            const el = document.createElement("div");
            el.className = "intercept-marker";
            el.setAttribute("aria-hidden", "true");
            interceptMarkerRef.current = new maplibregl.Marker({
              element: el,
              anchor: "center",
            })
              .setLngLat(entry.point)
              .addTo(map);
          } else {
            interceptMarkerRef.current.setLngLat(entry.point);
          }
          interceptMarkerRef.current.getElement().innerHTML =
            `<span style="display:flex; align-items:center; gap:4px;">` +
            `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 2 L12 12 M12 2 L2 12" stroke="#1d2630" stroke-width="3.5" stroke-linecap="round"/><path d="M2 2 L12 12 M12 2 L2 12" stroke="var(--status-warning)" stroke-width="1.8" stroke-linecap="round"/></svg>` +
            `<span style="font: 600 12px var(--font-geist-mono); color: var(--foreground); background: rgba(20,28,34,0.88); padding: 1px 5px; border-radius: 3px; border: 1px solid var(--border); white-space: nowrap;">~${entry.minutes} min</span></span>`;
        } else if (interceptMarkerRef.current) {
          interceptMarkerRef.current.remove();
          interceptMarkerRef.current = null;
        }
      }

      // List/board/sheet-driven focus: fly close and centre the contact in
      // the VISIBLE map area — the bottom sheet covers the lower part, so the
      // centre is offset upward by half the sheet height
      if (focusNonce !== lastFocusNonce.current) {
        lastFocusNonce.current = focusNonce;
        const target =
          selectedContactId != null ? contacts[selectedContactId] : undefined;
        if (target) {
          map.easeTo({
            center: [target.latest.longitude, target.latest.latitude],
            zoom: Math.max(map.getZoom(), 13),
            offset: [0, -sheetHeight / 2],
            duration: 800,
          });
        }
      }
    };

    const unsubscribe = useAppStore.subscribe(sync);
    const map = mapRef.current;
    if (map) {
      if (map.loaded()) sync();
      else map.once("load", sync);
      map.on("zoomend", sync);
    }
    return () => {
      unsubscribe();
      map?.off("zoomend", sync);
    };
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
