"use client";

import { useEffect, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

/** Registers the service worker once, in production only (dev HMR and SW caching don't mix). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        /* Non-fatal: the site works without the SW, just without offline fallback. */
      });
  }, []);
  return null;
}

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/**
 * Connection banner. Users on patchy networks need to know when an action
 * can't reach the server — especially anything involving money.
 */
export function ConnectionStatus() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-2 rounded-full bg-trade-900 px-4 py-2 text-sm font-medium text-white shadow-raised lg:bottom-6"
    >
      <WifiOff className="size-4 text-signal-400" aria-hidden="true" />
      You&apos;re offline. Orders and payments will wait until you reconnect.
    </div>
  );
}
