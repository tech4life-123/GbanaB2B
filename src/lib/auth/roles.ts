/**
 * Role architecture.
 *
 * - A user can hold several roles (a wholesaler may also buy; a carrier may
 *   also be a buyer). Roles live in `public.user_roles`, never in the JWT the
 *   client can influence and never in a form field we trust.
 * - buyer / seller / carrier can be requested by the user themselves.
 *   Holding the carrier role does NOT make someone a verified carrier —
 *   verification is a separate, admin-controlled record (Phase 4).
 * - admin can only be granted by an existing admin (or the database owner
 *   when bootstrapping). See supabase/migrations and docs/security.
 */

export const ROLES = ["buyer", "seller", "carrier", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const SELF_ASSIGNABLE_ROLES = ["buyer", "seller", "carrier"] as const satisfies readonly Role[];
export type SelfAssignableRole = (typeof SELF_ASSIGNABLE_ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isSelfAssignableRole(value: unknown): value is SelfAssignableRole {
  return typeof value === "string" && (SELF_ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

export interface RoleMeta {
  label: string;
  /** How the role describes itself on the onboarding card. */
  pitch: string;
  /** Workspace home path. */
  home: `/${Role}`;
}

export const ROLE_META: Record<Role, RoleMeta> = {
  buyer: {
    label: "Buyer",
    pitch: "Retailers and businesses buying stock in bulk.",
    home: "/buyer",
  },
  seller: {
    label: "Seller",
    pitch: "Wholesalers and importers selling by the carton, bag or pallet.",
    home: "/seller",
  },
  carrier: {
    label: "Carrier",
    pitch: "Drivers and fleets moving cargo between towns and counties.",
    home: "/carrier",
  },
  admin: {
    label: "Admin",
    pitch: "Platform operations, verification and finance oversight.",
    home: "/admin",
  },
};

/** Picks where a signed-in user should land. */
export function resolveHomeRole(roles: readonly Role[], preferred?: Role | null): Role | null {
  if (preferred && roles.includes(preferred)) return preferred;
  for (const r of ["admin", "seller", "buyer", "carrier"] as const) {
    if (roles.includes(r)) return r;
  }
  return null;
}
