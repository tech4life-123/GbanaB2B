/**
 * NOTE: row shapes are `type` aliases, not interfaces — supabase-js requires
 * them to be assignable to Record<string, unknown>, which interfaces are not.
 *
 * Hand-maintained types for the Phase 1 schema. Once a Supabase project is
 * linked, replace with `supabase gen types typescript` output (see README).
 * Keep in sync with supabase/migrations.
 */
import type { Role } from "@/lib/auth/roles";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AccountStatus = "active" | "suspended" | "closed";
export type RoleStatus = "active" | "revoked";

export type ProfileRow = {
  id: string;
  phone: string | null;
  full_name: string | null;
  display_name: string | null;
  preferred_currency: "USD" | "LRD";
  locale: string;
  default_role: Role | null;
  status: AccountStatus;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserRoleRow = {
  id: string;
  user_id: string;
  role: Role;
  status: RoleStatus;
  granted_by: string | null;
  granted_at: string;
  revoked_at: string | null;
};

export type PlatformSettingRow = {
  key: string;
  value: Json;
  description: string | null;
  is_sensitive: boolean;
  min_value: number | null;
  max_value: number | null;
  updated_by: string | null;
  updated_at: string;
};

export type AuditLogRow = {
  id: number;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Json;
  created_at: string;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      user_roles: Table<UserRoleRow>;
      platform_settings: Table<PlatformSettingRow>;
      audit_logs: Table<AuditLogRow>;
    };
    Views: Record<string, never>;
    Functions: {
      request_role: { Args: { p_role: Role }; Returns: undefined };
      set_default_role: { Args: { p_role: Role }; Returns: undefined };
      complete_onboarding: { Args: { p_full_name: string; p_role: Role }; Returns: undefined };
      grant_role: { Args: { p_user_id: string; p_role: Role }; Returns: undefined };
      revoke_role: { Args: { p_user_id: string; p_role: Role }; Returns: undefined };
      has_role: { Args: { p_role: Role }; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      update_platform_setting: { Args: { p_key: string; p_value: Json }; Returns: undefined };
    };
    Enums: {
      app_role: Role;
      account_status: AccountStatus;
      role_status: RoleStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
