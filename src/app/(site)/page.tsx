import {
  ArrowRight,
  BadgeCheck,
  Coins,
  EyeOff,
  FileText,
  Gavel,
  KeyRound,
  Lock,
  Wallet,
  Route,
  ShieldCheck,
  Smartphone,
  Store,
  Truck,
  Warehouse,
  Wifi,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TradePath, type FlowStep } from "@/components/brand/trade-path";
import { cn } from "@/lib/utils/cn";

const FLOW: FlowStep[] = [
  { key: "find", title: "Find stock", detail: "Search wholesale listings with MOQs, tier prices and full specs." },
  { key: "order", title: "Order in bulk", detail: "Prices lock the moment you order. The seller confirms." },
  { key: "bid", title: "Carriers bid", detail: "Verified carriers send sealed bids. You pick on price and ETA." },
  { key: "pay", title: "Pay into escrow", detail: "Your Mobile Money payment is held — not paid out to anyone yet.", escrow: true },
  { key: "deliver", title: "Goods move", detail: "Track the shipment from pickup to your door." },
  { key: "confirm", title: "Confirm & release", detail: "Check the goods, share your code, and payment is released." },
];

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Audiences />
      <Trust />
      <BuiltForLiberia />
      <ClosingCta />
    </>
  );
}

/* ------------------------------------------------------------------ Hero */

function Hero() {
  return (
    <section className="bg-manifest relative overflow-hidden text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -right-40 size-[36rem] rounded-full bg-signal-500/10 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pt-14 pb-16 sm:px-6 md:pt-20 md:pb-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="animate-fade-in">
          <Badge tone="navy" className="!bg-white/5 !text-signal-300 !ring-white/10">
            <span className="size-1.5 rounded-full bg-signal-400" aria-hidden="true" />
            Early access · Built in Monrovia
          </Badge>
          <h1 className="mt-5 text-[2.5rem] leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-[3.6rem]">
            Wholesale that <span className="text-signal-400">moves</span>.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-trade-100">
            Buy stock in bulk from importers and wholesalers, get sealed freight bids from verified carriers, and pay into
            escrow that only releases when the goods arrive.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/sign-in?intent=join&role=buyer" size="lg" icon={<ArrowRight className="size-5 order-last" aria-hidden="true" />}>
              Start buying wholesale
            </ButtonLink>
            <ButtonLink href="/sign-in?intent=join&role=seller" variant="inverse" size="lg">
              List your stock
            </ButtonLink>
          </div>
          <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-trade-200">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-escrow-400" aria-hidden="true" /> Escrow-protected
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="size-4 text-escrow-400" aria-hidden="true" /> Verified carriers
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Coins className="size-4 text-gold-500" aria-hidden="true" /> USD &amp; LRD
            </span>
          </p>
        </div>
        <ManifestCard />
      </div>
    </section>
  );
}

/** Illustrative waybill showing one order's journey. Labelled as an example — not live data. */
function ManifestCard() {
  const weight = 120 * 25 + 40 * 18.4; // rice bags + oil jerrycans, kg
  return (
    <figure
      className="animate-fade-in relative mx-auto w-full max-w-md [animation-delay:120ms]"
      aria-label="Example of how an order looks on GbanaB2B"
    >
      <div className="absolute -inset-3 -rotate-2 rounded-2xl border border-white/5 bg-white/[0.02]" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-xl bg-white text-trade-900 shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between border-b border-dashed border-line-strong px-5 py-3.5">
          <div>
            <p className="label-caps text-muted">Waybill · example</p>
            <p className="tabular font-mono text-sm font-semibold">GB-24-EXAMPLE</p>
          </div>
          <Badge tone="escrow">
            <Lock className="size-3" aria-hidden="true" />
            Held in escrow
          </Badge>
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-x-3 px-5 pt-4">
          <div className="flex flex-col items-center pt-1" aria-hidden="true">
            <span className="size-2.5 rounded-full border-2 border-trade-900" />
            <span className="my-1 h-8 w-0.5 bg-[linear-gradient(var(--color-signal-500)_50%,transparent_0)] bg-[length:2px_6px]" />
            <span className="size-2.5 rounded-full bg-signal-500" />
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <p className="label-caps text-muted">Pickup</p>
              <p className="font-semibold">Waterside, Monrovia</p>
            </div>
            <div>
              <p className="label-caps text-muted">Deliver to</p>
              <p className="font-semibold">Gbarnga, Bong County</p>
            </div>
          </div>
        </div>

        <ul className="mx-5 mt-4 divide-y divide-line rounded-md border border-line text-sm">
          <li className="flex justify-between gap-3 px-3 py-2">
            <span>Parboiled rice · 25 kg bag</span>
            <span className="tabular font-mono text-muted">× 120</span>
          </li>
          <li className="flex justify-between gap-3 px-3 py-2">
            <span>Vegetable oil · 20 L</span>
            <span className="tabular font-mono text-muted">× 40</span>
          </li>
        </ul>

        <div className="mx-5 mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">Cargo</span>
          <span className="tabular font-mono font-semibold">
            {new Intl.NumberFormat("en-US").format(weight)} kg · Large truck
          </span>
        </div>

        <div className="mx-5 mt-4 rounded-md bg-trade-50 p-3">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <EyeOff className="size-4 text-trade-600" aria-hidden="true" /> Sealed freight bids
            </p>
            <span className="label-caps text-muted">3 received</span>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2" aria-hidden="true">
            {["ETA 1d", "ETA 2d", "ETA 1d"].map((eta, i) => (
              <div
                key={i}
                className={cn(
                  "rounded border bg-white px-2 py-1.5 text-center",
                  i === 0 ? "border-signal-500 ring-2 ring-signal-500/20" : "border-line",
                )}
              >
                <p className="font-mono text-xs tracking-widest text-trade-400">•••</p>
                <p className="mt-0.5 text-[0.6875rem] font-medium text-muted">{eta}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Carriers never see each other&apos;s prices.</p>
        </div>

        <div className="mt-4 flex items-center gap-3 border-t border-dashed border-line-strong bg-escrow-50 px-5 py-3.5">
          <KeyRound className="size-5 shrink-0 text-escrow-700" aria-hidden="true" />
          <p className="text-sm text-escrow-800">
            Released to seller &amp; carrier only when the buyer&apos;s <strong>4-digit delivery code</strong> is confirmed.
          </p>
        </div>
      </div>
      <figcaption className="sr-only">
        An illustrative order: 120 bags of rice and 40 jerrycans of oil from Monrovia to Gbarnga, with three sealed carrier
        bids and payment held in escrow until delivery is confirmed.
      </figcaption>
    </figure>
  );
}

/* ---------------------------------------------------------- How it works */

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-b border-line bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <SectionHeading
          eyebrow="How it works"
          title="One route from order to delivery"
          lead="Every order follows the same trade path. You always know where your goods are — and where your money is."
        />
        <TradePath steps={FLOW} className="mt-12" />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Audiences */

function Audiences() {
  const cards = [
    {
      id: "buyers",
      icon: <Store className="size-6" aria-hidden="true" />,
      role: "For buyers",
      title: "Restock without the market run",
      points: [
        "Compare suppliers on price, MOQ and quantity tiers",
        "See real weights, packaging and handling notes",
        "Proforma invoice for every order — share it on WhatsApp",
        "Money stays in escrow until you confirm delivery",
      ],
      cta: { href: "/sign-in?intent=join&role=buyer", label: "Buy wholesale" },
    },
    {
      id: "sellers",
      icon: <Warehouse className="size-6" aria-hidden="true" />,
      role: "For sellers",
      title: "Sell by the carton, bag and pallet",
      points: [
        "List with MOQs and tiered pricing: 1–49, 50–99, 100+",
        "Reach retailers far beyond Monrovia",
        "Freight is arranged for the buyer — no chasing trucks",
        "Get paid the moment delivery is confirmed",
      ],
      cta: { href: "/sign-in?intent=join&role=seller", label: "Start selling" },
    },
    {
      id: "carriers",
      icon: <Truck className="size-6" aria-hidden="true" />,
      role: "For carriers",
      title: "Loads that fit your truck and route",
      points: [
        "Get verified once, then bid on matching loads",
        "Only see freight that fits your capacity and coverage",
        "Your bid stays private — no undercutting games",
        "Payment secured before you load",
      ],
      cta: { href: "/sign-in?intent=join&role=carrier", label: "Drive with GbanaB2B" },
    },
  ];

  return (
    <section className="bg-canvas">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <SectionHeading eyebrow="Three sides, one exchange" title="Built for everyone in the chain" />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {cards.map((c) => (
            <article
              key={c.id}
              id={c.id}
              className="group flex scroll-mt-24 flex-col rounded-xl border border-line bg-white p-6 shadow-card transition-shadow hover:shadow-raised"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-lg bg-trade-900 text-signal-400">{c.icon}</span>
                <p className="label-caps text-muted">{c.role}</p>
              </div>
              <h3 className="mt-5 text-xl font-extrabold tracking-tight text-trade-900">{c.title}</h3>
              <ul className="mt-4 flex-1 space-y-2.5">
                {c.points.map((p) => (
                  <li key={p} className="flex gap-2.5 text-[0.9375rem] leading-snug text-trade-800">
                    <span className="mt-2 h-0.5 w-3 shrink-0 bg-signal-500" aria-hidden="true" />
                    {p}
                  </li>
                ))}
              </ul>
              <ButtonLink
                href={c.cta.href}
                variant="outline"
                className="mt-6 w-full group-hover:border-trade-900"
                icon={<ArrowRight className="order-last size-4" aria-hidden="true" />}
              >
                {c.cta.label}
              </ButtonLink>
            </article>
          ))}
        </div>

        <CarrierClasses />
      </div>
    </section>
  );
}

function CarrierClasses() {
  const classes = [
    { name: "Small", range: "Up to 300 kg", example: "Motorbike, pickup, kehkeh cargo", bar: "w-[12%]" },
    { name: "Medium", range: "301 – 3,000 kg", example: "Box truck, light lorry", bar: "w-[45%]" },
    { name: "Large", range: "3,001 – 30,000+ kg", example: "Flatbed, container truck", bar: "w-full" },
  ];
  return (
    <div className="mt-12 overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex flex-col gap-1 border-b border-line px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-bold text-trade-900">Carrier classes</p>
        <p className="text-sm text-muted">Loads are matched on real payload capacity and route, not the label alone.</p>
      </div>
      <div className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
        {classes.map((c) => (
          <div key={c.name} className="px-6 py-5">
            <div className="flex items-baseline justify-between">
              <p className="text-lg font-extrabold text-trade-900">{c.name}</p>
              <p className="tabular font-mono text-sm font-semibold text-trade-700">{c.range}</p>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-trade-50" aria-hidden="true">
              <div className={cn("h-full rounded-full bg-signal-500", c.bar)} />
            </div>
            <p className="mt-3 text-sm text-muted">{c.example}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Trust */

function Trust() {
  const pillars = [
    {
      icon: <ShieldCheck className="size-5" aria-hidden="true" />,
      title: "Escrow on every order",
      body: "Payment is held — not handed over — until the buyer confirms delivery with a one-time code. Every movement of money is recorded in a ledger.",
    },
    {
      icon: <BadgeCheck className="size-5" aria-hidden="true" />,
      title: "Carriers are verified by people",
      body: "Licence, ID and vehicle are checked by the GbanaB2B team before a carrier can bid. Verification can't be self-declared.",
    },
    {
      icon: <EyeOff className="size-5" aria-hidden="true" />,
      title: "Sealed bidding",
      body: "Carriers can't see anyone else's price, ETA or ranking — enforced in the database, not just hidden on screen.",
    },
    {
      icon: <Gavel className="size-5" aria-hidden="true" />,
      title: "Disputes with evidence",
      body: "Missing, damaged or wrong goods? Open a dispute with photos. Funds stay frozen until it's resolved.",
    },
    {
      icon: <FileText className="size-5" aria-hidden="true" />,
      title: "Invoices that don't change",
      body: "Prices, freight and exchange rates are snapshotted when you order. A later price change never rewrites your invoice.",
    },
    {
      icon: <Route className="size-5" aria-hidden="true" />,
      title: "A full audit trail",
      body: "Approvals, refunds, releases and setting changes are logged permanently, with who did what and when.",
    },
  ];

  return (
    <section id="trust" className="bg-manifest scroll-mt-16 text-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <p className="label-caps text-escrow-400">Trust & escrow</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
              Nobody gets paid until the goods arrive.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-trade-100">
              Trading with someone new shouldn&apos;t mean trusting them with your money first. GbanaB2B sits in the middle.
            </p>
            <EscrowDiagram />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {pillars.map((p) => (
              <div key={p.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <span className="grid size-10 place-items-center rounded-lg bg-escrow-500/15 text-escrow-400">{p.icon}</span>
                <h3 className="mt-4 font-bold">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-trade-200">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function EscrowDiagram() {
  const nodes = [
    { label: "Buyer pays", sub: "Mobile Money" },
    { label: "Escrow holds", sub: "Ledgered", escrow: true },
    { label: "Code confirmed", sub: "At delivery" },
    { label: "Released", sub: "Seller + carrier" },
  ];
  return (
    <ol className="mt-8 grid grid-cols-4 gap-2" aria-label="How escrow works">
      {nodes.map((n, i) => (
        <li key={n.label} className="relative text-center">
          {i > 0 && (
            <span
              aria-hidden="true"
              className="rule-dashed absolute top-5 right-1/2 left-[-50%] -z-0 text-signal-500/60"
            />
          )}
          <span
            className={cn(
              "relative z-10 mx-auto grid size-10 place-items-center rounded-full font-mono text-xs font-bold",
              n.escrow ? "bg-escrow-500 text-trade-950 ring-4 ring-escrow-500/25" : "bg-trade-800 text-signal-400 ring-1 ring-signal-500/40",
            )}
          >
            {n.escrow ? <Lock className="size-4" aria-hidden="true" /> : i + 1}
          </span>
          <p className="mt-2 text-xs leading-tight font-semibold sm:text-sm">{n.label}</p>
          <p className="mt-0.5 text-[0.6875rem] text-trade-300">{n.sub}</p>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------ Built for Liberia */

function BuiltForLiberia() {
  const items = [
    {
      icon: <Smartphone className="size-5" aria-hidden="true" />,
      title: "Your phone number is your account",
      body: "Sign in with a code sent by SMS. No passwords to forget.",
    },
    {
      icon: <Coins className="size-5" aria-hidden="true" />,
      title: "USD and LRD, side by side",
      body: "Every price shows its currency. Exchange rates are recorded on each order.",
    },
    {
      icon: <Wifi className="size-5" aria-hidden="true" />,
      title: "Light on data",
      body: "Built for 3G and low-cost phones. Install it to your home screen like an app.",
    },
    {
      icon: <Wallet className="size-5" aria-hidden="true" />,
      title: "Mobile Money payments",
      body: "Designed around MTN Mobile Money and Orange Money wallets.",
    },
  ];
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <SectionHeading eyebrow="Made for here" title="Built for how Liberia trades" />
        <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it) => (
            <div key={it.title} className="border-t-2 border-trade-900 pt-5">
              <span className="text-signal-600">{it.icon}</span>
              <h3 className="mt-3 font-bold text-trade-900">{it.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{it.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 rounded-md border border-line bg-canvas px-4 py-3 text-sm text-muted">
          <strong className="text-trade-900">Early access:</strong> GbanaB2B is being built in phases. Accounts are open
          now; marketplace, freight and payments switch on as each part is completed and — for payments — certified with
          the mobile money providers.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Closing CTA */

function ClosingCta() {
  return (
    <section className="bg-signal-500">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-trade-900 sm:text-3xl">Get your business on the exchange.</h2>
          <p className="mt-1.5 text-trade-800">Create an account with your phone number in under a minute.</p>
        </div>
        <ButtonLink href="/sign-in?intent=join" variant="secondary" size="lg" icon={<ArrowRight className="order-last size-5" aria-hidden="true" />}>
          Join GbanaB2B
        </ButtonLink>
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="label-caps text-signal-700">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance text-trade-900 sm:text-4xl">{title}</h2>
      {lead && <p className="mt-3 text-lg leading-relaxed text-muted">{lead}</p>}
    </div>
  );
}
