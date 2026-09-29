import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Offline" };
// Fully static so the service worker can precache it.
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main id="main" className="bg-manifest flex min-h-dvh flex-col items-center justify-center px-6 text-center text-white">
      <LogoMark className="size-14" />
      <div className="mt-8 grid size-12 place-items-center rounded-full bg-white/5 ring-1 ring-white/10">
        <WifiOff className="size-6 text-signal-400" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight">You&apos;re offline</h1>
      <p className="mt-2 max-w-sm leading-relaxed text-trade-200">
        GbanaB2B needs a connection to show live orders, bids and payments. Nothing has been lost — reconnect and try again.
      </p>
      {/* A plain link (full navigation) so it works without JavaScript. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional hard reload to re-test the network */}
      <a
        href="/"
        className="mt-8 inline-flex h-11 items-center rounded-md bg-signal-500 px-5 font-semibold text-trade-900 hover:bg-signal-400"
      >
        Try again
      </a>
    </main>
  );
}
