import "server-only";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { ROLES, type Role } from "@/lib/auth/roles";
import type { AuditLogRow, PlatformSettingRow, ProfileRow } from "@/lib/db/types";

/**
 * Admin read models. Every query runs as the signed-in admin through RLS
 * (the *_select_admin policies) — never with the service-role key — so a
 * missing admin role yields empty results rather than leaked data.
 */

async function client() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new AppError("NOT_CONFIGURED", "Supabase is not configured.");
  return supabase;
}

export async function getPlatformOverview() {
  const supabase = await client();
  const [users, suspended, ...roleCounts] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).neq("status", "active"),
    ...ROLES.map((r) =>
      supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", r).eq("status", "active"),
    ),
  ]);
  for (const res of [users, suspended, ...roleCounts]) {
    if (res.error) logger.error("admin.overview_query_failed", { message: res.error.message });
  }
  return {
    totalUsers: users.count ?? 0,
    inactiveUsers: suspended.count ?? 0,
    roleCounts: Object.fromEntries(ROLES.map((r, i) => [r, roleCounts[i]?.count ?? 0])) as Record<Role, number>,
  };
}

export async function listRecentAudit(limit = 20): Promise<AuditLogRow[]> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) logger.error("admin.audit_query_failed", { message: error.message });
  return (data as AuditLogRow[] | null) ?? [];
}

export async function listSettings(): Promise<PlatformSettingRow[]> {
  const supabase = await client();
  const { data, error } = await supabase.from("platform_settings").select("*").order("key");
  if (error) logger.error("admin.settings_query_failed", { message: error.message });
  return (data as PlatformSettingRow[] | null) ?? [];
}

export interface UserWithRoles extends ProfileRow {
  roles: Role[];
}

export async function listUsers({ page = 1, pageSize = 25 }: { page?: number; pageSize?: number } = {}) {
  const supabase = await client();
  const from = (page - 1) * pageSize;
  const { data, count, error } = await supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) logger.error("admin.users_query_failed", { message: error.message });
  const profiles = (data as ProfileRow[] | null) ?? [];

  const ids = profiles.map((p) => p.id);
  const { data: roleRows } = ids.length
    ? await supabase.from("user_roles").select("user_id, role").in("user_id", ids).eq("status", "active")
    : { data: [] as { user_id: string; role: Role }[] };

  const byUser = new Map<string, Role[]>();
  for (const r of roleRows ?? []) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role]);

  return {
    users: profiles.map((p) => ({ ...p, roles: byUser.get(p.id) ?? [] })) as UserWithRoles[],
    total: count ?? 0,
    page,
    pageSize,
  };
}
