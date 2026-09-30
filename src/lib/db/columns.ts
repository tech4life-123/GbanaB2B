/**
 * Explicit column lists for tables where some columns are private.
 * `select *` fails on these tables by design (column-level grants), so queries
 * name what they read. See migration 20261005000100_privacy_hardening.sql.
 */

/** Everything a signed-in user may read on a business. The admin's internal verification note is fetched separately. */
export const BUSINESS_COLUMNS =
  "id, slug, trading_name, legal_name, business_type, description, county, town, address_line, contact_phone, " +
  "whatsapp_phone, registration_number, logo_path, status, verification_status, verified_at, created_by, created_at, updated_at";

/** Product columns the public marketplace reads (no created_by). */
export const PUBLIC_PRODUCT_COLUMNS =
  "id, business_id, category_id, slug, title, description, sku, unit_label, packaging_type, moq, quantity_available, currency, " +
  "origin_country, unit_weight_g, unit_volume_cm3, length_mm, width_mm, height_mm, is_fragile, is_stackable, max_stack_layers, " +
  "handling_notes, status, published_at, created_at, updated_at";
