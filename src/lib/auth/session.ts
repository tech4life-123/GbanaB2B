import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { isRole, resolveHomeRole, type Role } from "@/lib/auth/roles";
import type { ProfileRow } from "@/lib/db/types";
import { logger } from "@/lib/logging/logger";

export interface Viewer {
  id: string;
  phone: string | null;
  /** Set for accounts that sign in with email (temporary access accounts). */
  email: string | null;
  profile: ProfileRow | null;
  /** Active roles, read from the database — never from client input. */
  roles: Role[];
  homeRole: Role | null;
}

/**
 * Resolves the current user for this request (memoised per render).
 * Uses getUser(), which validates the session with Supabase Auth, rather than
 * trusting the cookie contents.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;
  const user = userData.user;

  const [profileRes, rolesRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("status", "active"),
  ]);

  if (profileRes.error) logger.error("viewer.profile_query_failed", { error: profileRes.error.message });
  if (rolesRes.error) logger.error("viewer.roles_query_failed", { error: rolesRes.error.message });

  const profile = (profileRes.data as ProfileRow | null) ?? null;
  const roles = (rolesRes.data ?? []).map((r) => r.role).filter(isRole);

  return {
    id: user.id,
    phone: user.phone ? `+${user.phone.replace(/^\+/, "")}` : null,
    email: user.email ?? null,
    profile,
    roles,
    homeRole: resolveHomeRole(roles, profile?.default_role),
  };
});

/** Requires a signed-in user or redirects to sign-in. */
export async function requireViewer(nextPath = "/"): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  return viewer;
}

/**
 * Requires the viewer to hold `role`. Users missing the role get a 404 rather
 * than a hint that the area exists (admin especially).
 */
export async function requireRole(role: Role): Promise<Viewer> {
  const viewer = await requireViewer(`/${role}`);
  if (viewer.profile?.status === "suspended") redirect("/account-suspended");
  if (!viewer.roles.includes(role)) {
    if (role === "admin") notFound();
    redirect(viewer.roles.length === 0 ? "/onboarding" : "/onboarding?add=" + role);
  }
  return viewer;
}
