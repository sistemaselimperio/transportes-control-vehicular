"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
/** Session-only fallback for when localStorage is unavailable. */
const memory = new Map<string, string>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    // Private windows / blocked storage: fall back to this session's memory.
    return memory.get(key) ?? null;
  }
}

/**
 * A string preference backed by localStorage. Renders `null` on the server and
 * on the first client render (so hydration always matches), then the saved
 * value. Every read and write is guarded: the UI must work without storage.
 */
export function useStoredString(key: string): [string | null, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const set = useCallback(
    (next: string) => {
      memory.set(key, next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Not persisted; still notify so this session reflects the change.
      }
      for (const notify of listeners) notify();
    },
    [key],
  );
  return [value, set];
}
