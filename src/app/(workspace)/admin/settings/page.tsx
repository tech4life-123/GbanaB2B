import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { listSettings } from "@/features/admin/queries";
import { formatSettingValue, SETTING_META, settingGroup, settingLabel } from "@/features/admin/settings-meta";
import { EditSettingButton } from "@/features/admin/components/edit-setting";
import type { PlatformSettingRow } from "@/lib/db/types";

export const metadata: Metadata = { title: "Settings · Admin" };

const updatedFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Monrovia" });

export default async function AdminSettingsPage() {
  const settings = await listSettings();
  const groups = new Map<string, PlatformSettingRow[]>();
  for (const s of settings) groups.set(settingGroup(s.key), [...(groups.get(settingGroup(s.key)) ?? []), s]);

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        eyebrow="Configuration"
        title="Platform settings"
        description="Business rules the platform reads at runtime. Every change is validated by the database and written to the audit log."
      />
      <Alert tone="info" title="Changes are never retroactive">
        Orders, invoices and payments snapshot the fee and exchange rate they were created with.
      </Alert>

      {[...groups.entries()].map(([group, rows]) => (
        <Card key={group}>
          <CardHeader eyebrow="Group" title={group} />
          <ul className="divide-y divide-line">
            {rows.map((s) => {
              const kind = typeof s.value === "number" ? "number" : typeof s.value === "boolean" ? "boolean" : "string";
              return (
                <li key={s.key} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-trade-900">{settingLabel(s.key)}</p>
                      {s.is_sensitive && <Badge tone="danger">Sensitive</Badge>}
                    </div>
                    <p className="mt-0.5 text-sm text-muted">{s.description}</p>
                    <p className="mt-1 font-mono text-[0.6875rem] text-trade-400">
                      {s.key} · updated {updatedFmt.format(new Date(s.updated_at))}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 sm:justify-end">
                    <span className="tabular rounded-md bg-trade-50 px-2.5 py-1 font-mono text-sm font-semibold text-trade-900">
                      {formatSettingValue(s.key, s.value)}
                    </span>
                    <EditSettingButton
                      settingKey={s.key}
                      label={settingLabel(s.key)}
                      kind={kind}
                      current={typeof s.value === "string" ? s.value : JSON.stringify(s.value)}
                      min={s.min_value}
                      max={s.max_value}
                      unit={SETTING_META[s.key]?.unit}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
