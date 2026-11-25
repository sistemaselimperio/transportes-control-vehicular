"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { refreshFleetAction } from "../application/cotero-actions";
import type { FleetCandidates } from "../domain/fleet-matching";

/** The active fleet receipts are matched against, and how to read it again. */
export interface FleetControl {
  fleet: FleetCandidates;
  refreshing: boolean;
  /** Reads the fleet again; resolves to the new one, or null when it could not be read. */
  refresh: () => Promise<FleetCandidates | null>;
}

/** Fleet candidates loaded once with the page, re-read on demand (a driver registered in another tab). */
export function useFleet(initial: FleetCandidates): FleetControl {
  const [fleet, setFleet] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return null;
    busy.current = true;
    setRefreshing(true);
    try {
      const result = await refreshFleetAction();
      if (!result.ok) return null;
      setFleet(result.fleet);
      return result.fleet;
    } catch {
      return null;
    } finally {
      busy.current = false;
      setRefreshing(false);
    }
  }, []);

  return { fleet, refreshing, refresh };
}

/** Calls `onFocus` whenever the window regains focus while `active` (coming back from another tab). */
export function useOnWindowFocus(active: boolean, onFocus: () => void): void {
  const latest = useRef(onFocus);
  useEffect(() => {
    latest.current = onFocus;
  });
  useEffect(() => {
    if (!active) return;
    const handler = () => latest.current();
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [active]);
}
