"use client";

import { useEffect, useRef } from "react";
import { track, type EveEvent } from "@/lib/analytics";

/**
 * Fires an event exactly once per mounted component.
 *
 * React StrictMode double-invokes effects in development, and a bare
 * useEffect(() => track(...), []) therefore emits every page-view event twice.
 * A ref guard survives the remount, so counts are correct in both dev and
 * production.
 *
 * `when` gates firing until data is ready (e.g. don't emit
 * recommendations_viewed until recommendations have actually loaded).
 */
export function useTrackOnce(
  event: EveEvent,
  properties: Record<string, unknown> = {},
  when: boolean = true
): void {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || !when) return;
    fired.current = true;
    track(event, properties);
    // properties is intentionally not a dependency: this fires once, and
    // including it would re-run on every render that rebuilds the object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, when]);
}
