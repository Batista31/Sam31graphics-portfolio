"use client";

import { useEffect } from "react";

/**
 * Registers the Service Worker that caches .mp4, .glb, .jpg assets browser-side.
 * This is what makes the portfolio fast on second visit — NOT Redis.
 *
 * On first load:  assets fetch from server (slow, normal)
 * On second load: assets served from browser disk cache (<20ms each)
 */
export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .then(() => caches.keys())
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .catch(() => {
          // Dev should keep working even if cache cleanup is blocked.
        });
      return;
    }

    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          // SW failed silently — site still works, just without offline cache
        });
    }
  }, []);

  return null;
}
