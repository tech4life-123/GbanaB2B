import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleSlash, FileClock } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/feedback";
import { StatusDot } from "@/components/ui/badge";
import { getPlatformOverview, listRecentAudit, listSettings } from "@/features/admin/queries";
import { formatSettingValue, settingLabel } from "@/features/admin/settings-meta";
import { AuditList } from "@/features/admin/components/audit-list";
import { getSupabaseSecretKey, isTemporaryAccessEnabled, serverEnv } from "@/config/env.server";
import { isAiConfigured } from "@/lib/ai/server";
import { Alert } from "@/components/ui/alert";
import { ROLE_META, ROLES } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  const [overview, audit, settings] = await Promise.all([getPlatformOverview(), listRecentAudit(6), listSettings()]);
  const fee = settings.find((s) => s.key === "commerce.platform_fee_bps");
  const sandboxOn = String(settings.find((s) => s.key === "payments.sandbox_enabled")?.value) === "1";
  const nf = new Intl.NumberFormat("en-US");

  const systems = [
    { label: "Database & auth", ok: true, detail: "Supabase connected" },
    { label: "Privileged server key", ok: Boolean(getSupabaseSecretKey()), detail: getSupabaseSecretKey() ? "Configured (server only)" : "Not set — webhooks & jobs unavailable" },
    { label: "Test payment provider", ok: sandboxOn, detail: sandboxOn ? "ON — no real money moves" : "Off" },
    { label: "Scheduled jobs", ok: Boolean(serverEnv.CRON_SECRET), detail: serverEnv.CRON_SECRET ? "Nightly sweep can run" : "CRON_SECRET not set — order expiry and auto-release won't run" },
    { label: "AI assistants", ok: isAiConfigured() && String(settings.find((s) => s.key === "ai.enabled")?.value) === "1", detail: !isAiConfigured() ? "Not connected — no provider key" : String(settings.find((s) => s.key === "ai.enabled")?.value) === "1" ? "On (advisory only)" : "Connected but switched off" },
    { label: "MTN Mobile Money", ok: false, detail: "Not connected — needs provider API access" },
    { label: "Orange Money", ok: false, detail: "Not connected — needs provider API access" },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader eyebrow="Operations" title="Platform overview" description="Live figures from the database. Everything on this page is visible only to administrators." />

      {isTemporaryAccessEnabled() && (
        <Alert tone="warning" title="Temporary password sign-in is ON">
          Pre-provisioned accounts can sign in with email and password while SMS codes are unavailable. Set{" "}
          <code className="font-mono text-xs">DEMO_ACCESS_ENABLED=false</code> in Vercel (and redeploy) once phone sign-in works.
        </Alert>
      )}

      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Accounts" value={nf.format(overview.totalUsers)} hint={overview.inactiveUsers ? `${overview.inactiveUsers} suspended or closed` : "All active"} />
        {ROLES.filter((r) => r !== "admin").map((r) => (
          <Stat key={r} label={`${ROLE_META[r].label}s`} value={nf.format(overview.roleCounts[r])} hint="Active role holders" />
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            eyebrow="Audit trail"
            title="Recent sensitive actions"
            action={
              <Link href="/admin/audit" className="inline-flex items-center gap-1 text-sm font-semibold text-trade-700 hover:text-trade-900">
                View all <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            }
          />
          {audit.length ? (
            <AuditList entries={audit} />
          ) : (
            <CardBody>
              <EmptyState compact icon={<FileClock className="size-5" />} title="No audited actions yet">
                Role grants, setting changes and — later — escrow releases and refunds will be recorded here permanently.
              </EmptyState>
            </CardBody>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader eyebrow="Business rules" title="Commission" />
            <CardBody>
              <p className="tabular font-mono text-3xl font-semibold text-trade-900">
                {fee ? formatSettingValue(fee.key, fee.value).split(" ")[0] : "—"}
              </p>
              <p className="mt-1 text-sm text-muted">{settingLabel("commerce.platform_fee_bps")} on product subtotal. Freight is passed through in full.</p>
              <Link href="/admin/settings" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-signal-700 hover:text-signal-800">
                Manage settings <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader eyebrow="Integrations" title="System status" />
            <ul className="divide-y divide-line px-5 py-1">
              {systems.map((s) => (
                <li key={s.label} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-trade-900">{s.label}</p>
                    <p className="text-[0.8125rem] text-muted">{s.detail}</p>
                  </div>
                  {s.ok ? (
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-escrow-600" aria-label="Operational" />
                  ) : (
                    <CircleSlash className="mt-0.5 size-5 shrink-0 text-trade-300" aria-label="Not connected" />
                  )}
                </li>
              ))}
            </ul>
            <div className="border-t border-line px-5 py-3">
              <StatusDot tone="escrow">No real payments can be processed until providers are certified.</StatusDot>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
