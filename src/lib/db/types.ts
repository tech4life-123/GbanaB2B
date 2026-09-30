/**
 * App-facing database types. The source of truth is the generated
 * `database.types.ts` (regenerate after each migration); this module gives
 * the rows friendly names.
 */
import type { Database, Enums, Json, Tables } from "./database.types";

export type { Database, Json };

export type AccountStatus = Enums<"account_status">;
export type RoleStatus = Enums<"role_status">;

export type ProfileRow = Tables<"profiles">;
export type UserRoleRow = Tables<"user_roles">;
export type PlatformSettingRow = Tables<"platform_settings">;
export type AuditLogRow = Tables<"audit_logs">;

// Marketplace (Phase 2)
export type BusinessRow = Tables<"businesses">;
export type BusinessMemberRow = Tables<"business_members">;
export type CategoryRow = Tables<"product_categories">;
export type ProductRow = Tables<"products">;
export type PriceTierRow = Tables<"product_price_tiers">;
export type SpecificationRow = Tables<"product_specifications">;
export type ProductImageRow = Tables<"product_images">;
export type ProductListingRow = Tables<"product_listings">;

export type BusinessType = Enums<"business_type">;
export type BusinessVerificationStatus = Enums<"business_verification_status">;
export type BusinessStatus = Enums<"business_status">;
export type ProductStatus = Enums<"product_status">;
export type PackagingType = Enums<"packaging_type">;
export type CurrencyCodeDb = Enums<"currency_code">;
