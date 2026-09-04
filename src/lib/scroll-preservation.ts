"use client";

import { useEffect } from "react";

/**
 * Works around a real Next.js App Router behavior: any client-side
 * navigation (even a searchParams-only one, with `scroll={false}` on the
 * Link) still resets `window.scrollY` to 0 synchronously on click — this is
 * the router's own accessibility focus-management running independently of
 * the `scroll` option, not something `scroll={false}` can prevent. Confirmed
 * by sampling scrollY every 50ms immediately after a real click: it's 0 in
 * the very first sample, well before any RSC payload could have arrived.
 *
 * The fix: save the scroll position (sessionStorage, so it survives the
 * full client-tree remount a route's RSC swap causes) right before
 * triggering the navigation, then re-assert it for a few animation frames
 * after the page remounts — long enough to reliably win against the
 * router's own reset, short enough to be invisible to the user.
 */

const STORAGE_KEY = "internin-scroll-restore";

export function saveScrollPosition() {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(window.scrollY));
  } catch {
    // Best-effort — a blocked/unavailable sessionStorage just means no restore happens.
  }
}

/** Call once from a component that remounts fresh on every navigation of
 * the route it lives on (e.g. the always-rendered detail Dialog) — it
 * consumes and clears any pending saved position on mount. */
export function useRestoreScrollPosition() {
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw !== null) sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (raw === null) return;
    const target = Number(raw);
    if (!Number.isFinite(target)) return;

    let frame = 0;
    let raf: number;
    const tick = () => {
      if (Math.abs(window.scrollY - target) > 2) window.scrollTo(0, target);
      frame += 1;
      if (frame < 8) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}
