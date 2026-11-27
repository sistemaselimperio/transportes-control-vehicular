"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";

/** Runs a server action in a transition, keeping its pending state and the last error for the screen. */
export function useTurnAction(onDone: (message: string) => void) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        onDone(result.message);
        after?.();
      } else setError(result.error);
    });
  }

  return { run, pending, error };
}
