import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/feedback";
import { requireRole } from "@/lib/auth/session";
import { formatMoney, type CurrencyCode } from "@/lib/money/currency";
import { getAiStatus } from "@/features/ai/run";
import { getMarketplaceSnapshot, type MarketplaceSnapshot } from "@/features/ai/queries";
import { AiStatusBanner } from "@/features/ai/components/ai-bits";
import { AdminBriefing } from "@/features/ai/components/admin-briefing";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Assistant · Admin" };

const WINDOWS = [7, 30, 90] as const;
const nf = new Intl.NumberFormat("en-US");
const label = (k: string) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export default async function AdminAssistantPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireRole("admin");
  const asked = Number((await searchParams).days);
  const days = (WINDOWS as readonly number[]).includes(asked) ? asked : 30;
  const [status, snap] = await Promise.all([getAiStatus(), getMarketplaceSnapshot(days)]);
  const off = !status.configured || !status.enabled;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Admin" title="Assistant" description="Marketplace numbers straight from the database, with an optional plain-language briefing. Advisory only — every decision stays with a person." />
      <AiStatusBanner status={status} />

      <nav aria-label="Time window" className="flex gap-2">
        {WINDOWS.map((w) => (
          <Link
            key={w}
            href={`/admin/assistant?days=${w}`}
            aria-current={w === days ? "page" : undefined}
            className={cn("inline-flex h-10 items-center rounded-md border px-3.5 text-sm font-semibold", w === days ? "border-trade-900 bg-trade-900 text-white" : "border-line-strong bg-white text-trade-800 hover:bg-trade-50")}
          >
            Last {w} days
          </Link>
        ))}
      </nav>

      {!snap ? (
        <EmptyState title="Numbers unavailable">We couldn&rsquo;t read the marketplace snapshot just now. Try again in a moment.</EmptyState>
      ) : (
        <Snapshot snap={snap} />
      )}

      <AdminBriefing days={days} disabled={off || !snap} />
    </div>
  );
}

function Breakdown({ title, data, money }: { title: string; data: Record<string, number>; money?: boolean }) {
  const rows = Object.entries(data ?? {});
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">Nothing in this window.</p>
        ) : (
          <dl className="space-y-1.5 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-line py-1 last:border-0">
                <dt className="text-muted">{money ? k : label(k)}</dt>
                <dd className="tabular font-mono font-semibold text-trade-900">{money ? formatMoney({ amountMinor: v, currency: k as CurrencyCode }) : nf.format(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardBody>
    </Card>
  );
}

function Snapshot({ snap }: { snap: MarketplaceSnapshot }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Live disputes" value={nf.format(snap.live_disputes)} hint={snap.oldest_live_dispute_days !== null ? `Oldest open ${snap.oldest_live_dispute_days} d` : "None open"} />
        <Stat label="Waiting on seller >24 h" value={nf.format(snap.orders_awaiting_seller_over_24h)} />
        <Stat label="In transit" value={nf.format(snap.orders_in_transit)} />
        <Stat label="Payouts pending" value={nf.format(snap.payouts_pending)} />
        <Stat label="Carriers to verify" value={nf.format(snap.carriers_awaiting_verification)} />
        <Stat label="Businesses to verify" value={nf.format(snap.businesses_awaiting_verification)} />
        <Stat label="Sellers: 3+ cancellations" value={nf.format(snap.sellers_with_3plus_cancellations)} hint="A count to review, not a finding." />
        <Stat label="Upheld disputes (seller / carrier)" value={`${nf.format(snap.sellers_with_upheld_disputes)} / ${nf.format(snap.carriers_with_upheld_disputes)}`} hint="Counts of parties, not names." />
      </div>
      {snap.live_disputes > 0 && (
        <Alert tone="warning" title="Disputes are holding money">
          Open disputes freeze their escrow until an admin decides. <Link href="/admin/disputes" className="font-semibold underline">Review them</Link>.
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Breakdown title="Orders by status" data={snap.orders_by_status} />
        <Breakdown title="Payments by status" data={snap.payments_by_status} />
        <Breakdown title="Disputes by kind" data={snap.disputes_by_kind} />
        <Breakdown title="Disputes by status" data={snap.disputes_by_status} />
        <Breakdown title="Completed order value" data={snap.completed_value_minor} money />
        <Breakdown title="Held in escrow now" data={snap.escrow_held_minor} money />
      </div>
    </div>
  );
}
