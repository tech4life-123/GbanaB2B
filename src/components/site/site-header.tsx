import Link from "next/link";
import { LayoutDashboard, Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

const NAV = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#sellers", label: "Sell" },
  { href: "/#carriers", label: "Carriers" },
  { href: "/#trust", label: "Trust & escrow" },
];

export interface HeaderAccount {
  /** Workspace home, e.g. "/buyer". */
  home: string;
}

/**
 * Public header. On marketing pages it's static (no session lookup) so they
 * stay cacheable; marketplace pages pass `account` so signed-in users get a
 * way back to their workspace instead of "Sign in".
 */
export function SiteHeader({ account }: { account?: HeaderAccount | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-trade-900/95 backdrop-blur supports-[backdrop-filter]:bg-trade-900/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="rounded-md" aria-label="GbanaB2B home">
          <Logo tone="light" />
        </Link>
        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-trade-100 transition-colors hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {account ? (
            <ButtonLink href={account.home} size="sm" icon={<LayoutDashboard className="size-4" aria-hidden="true" />}>
              My workspace
            </ButtonLink>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden rounded-md px-3 py-2 text-sm font-semibold text-white hover:bg-white/5 sm:inline-flex"
              >
                Sign in
              </Link>
              <ButtonLink href="/sign-in?intent=join" size="sm">
                Join the exchange
              </ButtonLink>
            </>
          )}
          {/* No-JS mobile menu */}
          <details className="group relative lg:hidden">
            <summary
              className="grid size-10 cursor-pointer list-none place-items-center rounded-md text-white hover:bg-white/10 [&::-webkit-details-marker]:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" aria-hidden="true" />
            </summary>
            <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-lg border border-line bg-white p-2 shadow-raised">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-md px-3 py-2.5 text-[0.9375rem] font-medium text-trade-900 hover:bg-trade-50"
                >
                  {item.label}
                </Link>
              ))}
              {!account && (
                <div className="mt-2 grid gap-2 border-t border-line pt-2">
                  <ButtonLink href="/sign-in" variant="outline" size="md">
                    Sign in
                  </ButtonLink>
                  <ButtonLink href="/sign-in?intent=join" size="md">
                    Join the exchange
                  </ButtonLink>
                </div>
              )}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
