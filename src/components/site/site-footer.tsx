import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="bg-trade-950 text-trade-200">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo tone="light" showTagline />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-trade-300">
            Wholesale buying, competitive freight and protected payments — built for how business moves in Liberia.
          </p>
        </div>
        <FooterCol
          title="Exchange"
          links={[
            { href: "/#how-it-works", label: "How it works" },
            { href: "/#trust", label: "Escrow & trust" },
            { href: "/#carriers", label: "Carrier classes" },
          ]}
        />
        <FooterCol
          title="Join"
          links={[
            { href: "/sign-in?intent=join&role=buyer", label: "Buy wholesale" },
            { href: "/sign-in?intent=join&role=seller", label: "Sell wholesale" },
            { href: "/sign-in?intent=join&role=carrier", label: "Drive with us" },
          ]}
        />
        <FooterCol
          title="Platform"
          links={[
            { href: "/sign-in", label: "Sign in" },
            { href: "/design-system", label: "Design system" },
          ]}
        />
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-trade-300 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} GbanaB2B. Monrovia, Liberia.</p>
          <p className="label-caps !text-[0.625rem] text-trade-300">USD · LRD · Mobile Money</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="label-caps text-trade-300">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-sm text-trade-100 hover:text-signal-400">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
