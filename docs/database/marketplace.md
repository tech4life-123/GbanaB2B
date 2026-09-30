# Marketplace schema (Phase 2)

Migrations: `20260930000100_marketplace.sql`, `20260930000200_product_image_storage.sql`, `20260930000300_products_slug_default.sql`. Tests: `supabase/tests/20_phase2_marketplace.sql` (56 assertions).

## businesses
- **Purpose:** trading entities. Sellers now; buyer businesses and fleets later.
- **Key fields:** `slug` (generated, immutable), `trading_name`, `business_type`, `county` (domain `lr_county` — Liberia's 15 counties), `town`, contact phones (E.164), `registration_number`, `verification_status` (unverified → pending → verified / rejected), `status` (active / suspended / closed).
- **Created by:** `create_business()` — requires the `seller` role, one owned business per person (ADR 0007), makes the caller `owner`, audits `business.created`.
- **Changed by:** owners/managers may update profile columns (column grants). `verification_status`, `status`, `slug` are admin-only via `admin_review_business()` (audited; rejection requires a note; suspending pauses all live listings).
- **RLS:** anon sees active businesses; members and admins see their own/all.

## business_members
Owner / manager / staff. No direct writes (invitations come later). Visible to fellow members and admins.

Helpers: `is_business_member(id)`, `can_edit_business(id)` = owner/manager **and** holds the seller role **and** business active. Losing the seller role or being suspended removes edit rights immediately.

## product_categories
Seeded with 20 Liberia-relevant categories. Admin-only writes (RLS `is_admin()`), audited by trigger (`category.created` / `category.updated`). Hidden categories disappear from public browse but listings keep them. `parent_id` supports a tree later.

## products
- **Unit model:** `unit_label` says what one unit is ("25 kg bag"); `moq`, `quantity_available` and all tier quantities count these units.
- **Logistics:** `unit_weight_g` (required to publish), `unit_volume_cm3` (derived from dimensions), `length/width/height_mm`, `is_fragile`, `is_stackable`, `max_stack_layers`, `handling_notes`. Integers only — no float drift.
- **Lifecycle:** `draft → active ⇄ paused → archived`. Enforced by `products_guard()`:
  - inserts always start as `draft`; slug and `created_by` are stamped
  - publishing requires weight, ≥1 tier, first tier = MOQ, active business
  - `business_id` and `slug` can't change; `archived` is terminal
  - only drafts can be deleted
- **Search:** generated `search_vector` (English config; title/SKU weight A, unit B, description C) with a GIN index.
- **Column grants:** clients cannot set `status` on insert, `moq`/`currency` on update (only via `save_product_pricing`), `slug`, `published_at`, `created_by`.

## product_price_tiers
Written only by `save_product_pricing(product, moq, currency, tiers)`: 1–10 contiguous bands, first starts at MOQ, last open-ended, prices 1…10¹¹ minor units. Replaces all tiers and MOQ atomically; an active listing is re-validated by the product trigger. The TypeScript mirror (`lib/pricing/tiers.ts`) gives instant form feedback only.

## product_specifications
Label/value rows, ≤30, replaced atomically by `save_product_specifications()`.

## product_images + storage
Bucket `product-images` is **public-read** (listing photos are public by nature — ADR 0008), 2 MB limit, JPEG/PNG/WebP only. Paths are `{business_id}/{product_id}/{file}`; storage policies allow writes only where the first segment is a business the caller can edit. The `product_images` row insert re-checks the path matches the product's business and caps photos at 8. Photos are compressed to ≤1600 px WebP in the browser before upload.

## product_listings (view)
`security_invoker = true`, so it returns exactly what the caller may see. Adds business/category names, `min_price_minor`, `moq_price_minor`, `tier_count`, `cover_image_path`. Public pages query it with a cookie-less anon client, so sellers previewing their shop see the real public view.

## RLS summary

| Table | anon | seller (editor) | other signed-in | admin |
| --- | --- | --- | --- | --- |
| businesses | active | own + active | active | all |
| products | active of active business | own (all statuses), write own | active | all (read) |
| tiers/specs/images | follow product visibility | write via functions/policies | follow | follow |
| categories | active | active | active | all + write |
| storage product-images | read (public bucket) | write own folder | — | — |
