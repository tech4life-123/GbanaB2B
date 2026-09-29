import Link from "next/link";
import { BadgeCheck, EyeOff, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";

/** Split layout for sign-in and onboarding: brand panel on desktop, focused form on phones. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <aside className="bg-manifest relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-32 size-[28rem] rounded-full bg-escrow-500/10 blur-3xl" />
        <Link href="/" className="relative w-fit rounded-md">
          <Logo tone="light" showTagline />
        </Link>
        <div className="relative max-w-md">
          <p className="label-caps text-signal-400">Wholesale & freight exchange</p>
          <p className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-balance">
            Buy in bulk. Ship with verified carriers. Pay only for what arrives.
          </p>
          <ul className="mt-8 space-y-4 text-trade-100">
            <li className="flex gap-3">
              <ShieldCheck className="size-5 shrink-0 text-escrow-400" aria-hidden="true" />
              Payments held in escrow until delivery is confirmed
            </li>
            <li className="flex gap-3">
              <BadgeCheck className="size-5 shrink-0 text-escrow-400" aria-hidden="true" />
              Carriers checked by our team before they can bid
            </li>
            <li className="flex gap-3">
              <EyeOff className="size-5 shrink-0 text-escrow-400" aria-hidden="true" />
              Sealed freight bids — fair prices, no undercutting
            </li>
          </ul>
        </div>
        <p className="relative label-caps text-trade-400">Monrovia · Liberia</p>
      </aside>

      <div className="flex flex-col">
        <header className="flex h-16 items-center border-b border-line bg-white px-4 lg:hidden">
          <Link href="/" className="rounded-md" aria-label="GbanaB2B home">
            <Logo />
          </Link>
        </header>
        <main id="main" className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-16">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
