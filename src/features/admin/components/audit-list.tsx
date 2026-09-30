import { Badge, type Tone } from "@/components/ui/badge";
import type { AuditLogRow } from "@/lib/db/types";

const ACTION_LABELS: Record<string, { label: string; tone: Tone }> = {
  "role.self_assigned": { label: "Role added by user", tone: "neutral" },
  "role.granted": { label: "Role granted", tone: "info" },
  "role.revoked": { label: "Role revoked", tone: "danger" },
  "role.bootstrap_admin": { label: "First admin created", tone: "gold" },
  "platform_setting.updated": { label: "Setting changed", tone: "signal" },
  "account.temporary_access_provisioned": { label: "Temporary access account", tone: "signal" },
  "business.created": { label: "Business created", tone: "neutral" },
  "business.reviewed": { label: "Business reviewed", tone: "info" },
  "category.created": { label: "Category created", tone: "neutral" },
  "category.updated": { label: "Category updated", tone: "neutral" },
};

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Monrovia",
});

function describe(entry: AuditLogRow): string {
  const m = (entry.metadata ?? {}) as Record<string, unknown>;
  if (entry.action === "platform_setting.updated") return `${entry.entity_id}: ${JSON.stringify(m.old)} → ${JSON.stringify(m.new)}`;
  if (entry.action === "business.reviewed")
    return `${String(m.old_verification)} → ${String(m.new_verification)}, ${String(m.old_status)} → ${String(m.new_status)}`;
  if (typeof m.trading_name === "string") return m.trading_name;
  if (entry.entity_type === "product_category" && typeof m.name === "string") return `${m.name}${m.is_active === false ? " (hidden)" : ""}`;
  if (typeof m.email === "string") return `${m.email}${Array.isArray(m.roles) && m.roles.length ? ` · ${m.roles.join(", ")}` : ""}`;
  if (typeof m.role === "string") return `${m.role} · user ${entry.entity_id?.slice(0, 8)}`;
  return `${entry.entity_type}${entry.entity_id ? ` · ${entry.entity_id.slice(0, 12)}` : ""}`;
}

export function AuditList({ entries }: { entries: AuditLogRow[] }) {
  return (
    <ul className="divide-y divide-line">
      {entries.map((e) => {
        const meta = ACTION_LABELS[e.action] ?? { label: e.action, tone: "neutral" as Tone };
        return (
          <li key={e.id} className="flex flex-col gap-1.5 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
            <time dateTime={e.created_at} className="tabular w-28 shrink-0 font-mono text-xs text-muted">
              {dateFmt.format(new Date(e.created_at))}
            </time>
            <div className="min-w-0 flex-1">
              <Badge tone={meta.tone}>{meta.label}</Badge>
              <p className="mt-1 truncate font-mono text-xs text-trade-700">{describe(e)}</p>
            </div>
            <p className="shrink-0 text-xs text-muted">
              by <span className="font-medium text-trade-800">{e.actor_role ?? "system"}</span>
              {e.actor_id && <span className="font-mono"> · {e.actor_id.slice(0, 8)}</span>}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
