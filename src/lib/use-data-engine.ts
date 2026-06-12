"use client";

import { useEffect, useRef } from "react";
import { THRESHOLDS } from "./config";
import { scenarioReports } from "./scenario";
import { sensorReports } from "./sensor-feed";
import { scenarioNowMs, useAppStore } from "./store";
import type { PositionReport } from "./types";

/**
 * Drives the data layer for whichever mode is active.
 *  - live: polls /api/ais and accumulates tracks; falls back to scenario mode
 *    if credentials are missing or the upstream fails on first contact.
 *  - scenario: advances the replay clock and rebuilds the deterministic scene.
 * Both modes also ingest the illustrative non-AIS sensor feed — through the
 * same pipeline as AIS, which is the point of the source-agnostic model.
 * A steady tick re-derives events so time-based conditions (AIS gaps) age
 * correctly between data arrivals.
 */
export function useDataEngine() {
  const mode = useAppStore((s) => s.mode);
  const scenarioAnchorMs = useAppStore((s) => s.scenarioAnchorMs);
  const hadLiveContact = useRef(false);

  // Live polling
  useEffect(() => {
    if (mode !== "live") return;
    let cancelled = false;
    const store = useAppStore.getState();
    store.setLiveStatus("connecting");

    async function poll() {
      try {
        const res = await fetch("/api/ais");
        if (cancelled) return;
        if (res.status === 503) {
          useAppStore.getState().setLiveStatus("no-credentials");
          if (!hadLiveContact.current) useAppStore.getState().setMode("scenario");
          return;
        }
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { positions: PositionReport[] };
        if (cancelled) return;
        hadLiveContact.current = true;
        const nowMs = Date.now();
        // AIS + illustrative sensor feed through the same ingest
        const sensor = sensorReports(
          nowMs - THRESHOLDS.trackHistoryMinutes * 60_000,
          nowMs
        );
        useAppStore
          .getState()
          .ingestReports([...data.positions, ...sensor], nowMs, false);
        useAppStore.getState().setLiveStatus("ok");
      } catch {
        if (cancelled) return;
        useAppStore.getState().setLiveStatus("error");
        if (!hadLiveContact.current) useAppStore.getState().setMode("scenario");
      }
    }

    poll();
    const interval = setInterval(poll, THRESHOLDS.livePollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [mode]);

  // Steady tick: scenario rebuild / live event aging
  useEffect(() => {
    if (mode === "scenario" && scenarioAnchorMs == null) {
      useAppStore.getState().restartScenario();
      return;
    }

    function tick() {
      const state = useAppStore.getState();
      if (state.mode === "scenario" && state.scenarioAnchorMs != null) {
        const nowMs = scenarioNowMs(state, Date.now());
        const nowSec = (nowMs - state.scenarioAnchorMs) / 1000;
        const fromSec = nowSec - THRESHOLDS.trackHistoryMinutes * 60;
        const reports = scenarioReports(fromSec, nowSec, state.scenarioAnchorMs);
        const sensor = sensorReports(
          nowMs - THRESHOLDS.trackHistoryMinutes * 60_000,
          nowMs
        );
        state.ingestReports([...reports, ...sensor], nowMs, true);
      } else {
        state.refresh(Date.now());
      }
    }

    tick();
    const interval = setInterval(tick, mode === "scenario" ? 1000 : 5000);
    return () => clearInterval(interval);
  }, [mode, scenarioAnchorMs]);
}
