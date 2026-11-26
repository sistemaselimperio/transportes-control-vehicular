"use client";

import { useEffect } from "react";
import { reloadIfStaleDeployment } from "@/lib/stale-deployment";

/** Reloads the page when any uncaught Server Action call fails because a deploy replaced it. */
export function StaleDeploymentGuard() {
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (reloadIfStaleDeployment(event.reason)) event.preventDefault();
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);
  return null;
}
