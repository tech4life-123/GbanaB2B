import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/data";
import { EmptyState, PageHeader, Stat } from "@/components/ui/feedback";
import { CheckPaymentButton, ExchangeRateForm } from "@/features/payments/components/admin-money";
import { FinanceTabs } from "@/features/payments/components/finance-tabs";
import { getFinanceExceptions, getLedgerBalances, getPaymentMethods, getUsdLrdRate, listEscrow, listRateHistory } from "@/features/payments/queries";
import { requireRole } from "@/lib/auth/session";
import { LEDGER_ACCOUNT } from "@/lib/payments/labels";
import { PAYMENT_PROVIDERS } from "@/lib/payments/types";
import { getProvider } from "@/lib/payments/registry";

export const metadata: Metadata = { title: "Finance · Admin" };
const when = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Monrovia" });

export default async function AdminFinancePage() {
  await requireRole("admin");
  const [balances, exceptions, rate, rates, methods, held] = await Promise.all([getLedgerBalances(), getFinanceExceptions(), getUsdLrdRate(), listRateHistory(6), getPaymentMethods(), listEscrow(200)]);
  const bal = (account: string, currency: "USD" | "LRD") => balances.find((b) => b.account === account && b.currency === currency)?.balance_minor ?? 0;
  const currencies = (["USD", "LRD"] as const).filter((c) => balances.some((b) => b.currency === c));
  const showCurrencies = currencies.length ? currencies : (["USD"] as const);
  const heldCount = held.filter((e) => e.status === "held").length;
  const needsAttention = exceptions.stale.length + exceptions.unapplied.length + exceptions.failedPayouts + exceptions.openRefunds;
  const testOn = methods.some((m) => m.isTest);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Admin" title="Finance" description="Where the money is. Every figure comes from the append-only ledger — nothing here can be edited." />
      <FinanceTabs active="overview" />

      {testOn && (
        <Alert tone="warning" title="The test payment provider is ON">
          Buyers can &ldquo;pay&rdquo; with test money. Switch <code className="font-mono text-xs">payments.sandbox_enabled</code> off in <Link href="/admin/settings" className="font-semibold underline">Settings</Link> before real launch.
        </Alert>
      )}
      {(["mtn_momo_lr", "orange_money_lr"] as const).map((id) =>
        getProvider(id).isConfigured() ? null : (
          <p key={id} className="text-sm text-muted">
            <span className="font-semibold text-trade-800">{PAYMENT_PROVIDERS[id].displayName}</span> is not connected — waiting for provider API access and credentials.
          </p>
        ),
      )}

      {showCurrencies.map((c) => (
        <section key={c} aria-label={`${c} balances`} className="space-y-3">
          <h2 className="label-caps text-muted">{c}</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat tone="escrow" label="Held in escrow" value={<MoneyText value={{ amountMinor: bal("escrow", c), currency: c }} />} hint={`${heldCount} order${heldCount === 1 ? "" : "s"} across currencies`} />
            <Stat label="Platform fees earned" value={<MoneyText value={{ amountMinor: bal("platform_fees", c), currency: c }} />} />
            <Stat label="Owed to sellers" value={<MoneyText value={{ amountMinor: bal("seller_payable", c), currency: c }} />} />
            <Stat label="Owed to carriers" value={<MoneyText value={{ amountMinor: bal("carrier_payable", c), currency: c }} />} />
          </div>
        </section>
      ))}

      <Card>
        <CardHeader eyebrow="Needs a human" title={needsAttention === 0 ? "Nothing needs attention" : `${needsAttention} item${needsAttention === 1 ? "" : "s"} need attention`} />
        <CardBody className="space-y-4">
          {needsAttention === 0 && <p className="text-sm text-muted">No stale payments, unmatched money, failed payouts or open refunds.</p>}
          {exceptions.stale.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-bold text-trade-900"><AlertTriangle className="size-4 text-signal-600" aria-hidden="true" /> Payments waiting over an hour</h3>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {exceptions.stale.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span>
                      <Link href={`/admin/orders/${t.order_id}`} className="font-semibold text-trade-900 underline-offset-2 hover:underline">{t.order?.order_number}</Link>
                      <span className="text-muted"> · {PAYMENT_PROVIDERS[t.provider].displayName} · {when.format(new Date(t.created_at))}</span>
                    </span>
                    <CheckPaymentButton txnId={t.id} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {exceptions.unapplied.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-bold text-trade-900"><AlertTriangle className="size-4 text-red-600" aria-hidden="true" /> Money received that no order could take</h3>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {exceptions.unapplied.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span>
                      {u.order_id ? <Link href={`/admin/orders/${u.order_id}`} className="font-semibold text-trade-900 hover:underline">{u.order?.order_number}</Link> : "Unknown order"}
                      <span className="text-muted"> · {when.format(new Date(u.created_at))} · refund the payer outside the app, then note it in the audit log</span>
                    </span>
                    <MoneyText value={{ amountMinor: u.amount_minor, currency: u.currency }} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(exceptions.failedPayouts > 0 || exceptions.openRefunds > 0) && (
            <Link href="/admin/finance/payouts" className="inline-flex items-center gap-1.5 text-sm font-semibold text-trade-800 hover:underline">
              {exceptions.failedPayouts} failed payout{exceptions.failedPayouts === 1 ? "" : "s"}, {exceptions.openRefunds} open refund{exceptions.openRefunds === 1 ? "" : "s"} <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader eyebrow="Currency" title="USD → LRD exchange rate" description="Each payment remembers the rate it was made at. Changing it never rewrites old payments." />
        <CardBody className="space-y-5">
          {!rate && <Alert tone="info">No rate is set, so the app doesn&apos;t show converted amounts anywhere. Enter one to turn conversions on.</Alert>}
          <ExchangeRateForm current={rate ? Number(rate.rate) : null} />
          {rates.length > 0 ? (
            <ul className="divide-y divide-line rounded-lg border border-line text-sm">
              {rates.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span className="font-mono font-semibold text-trade-900">1 {r.base} = {Number(r.rate).toLocaleString("en-US", { maximumFractionDigits: 6 })} {r.quote}</span>
                  <span className="text-xs text-muted">{r.note ? `${r.note} · ` : ""}{when.format(new Date(r.effective_at))}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No rate history yet" />
          )}
        </CardBody>
      </Card>

      {balances.length > 0 && (
        <Card>
          <CardHeader eyebrow="Ledger" title="All account balances" description="Credits minus debits per account. Every entry group balances to zero." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {balances.map((b) => (
                  <tr key={`${b.account}-${b.currency}`}>
                    <td className="px-5 py-2.5 text-trade-800">{LEDGER_ACCOUNT[b.account ?? ""] ?? b.account}</td>
                    <td className="px-5 py-2.5 text-xs text-muted">{b.entries} entries</td>
                    <td className="px-5 py-2.5 text-right font-mono font-semibold">{b.currency && <MoneyText value={{ amountMinor: b.balance_minor ?? 0, currency: b.currency }} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
