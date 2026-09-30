# Freight exchange (Phase 4)

Migration: `supabase/migrations/20261001000100_freight.sql`. Tests: `supabase/tests/40_phase4_freight.sql` (90 assertions).

| Table | Purpose | Who can see it |
| --- | --- | --- |
| `carrier_profiles` | Carrier identity, phone, coverage counties, availability, verification status/notes. | Owner; admin. Verified carriers show only a name + badge on bids. |
| `vehicles` | Plate, type, payload (kg), volume; generated `vehicle_class` from payload; `is_verified`. | Owner; admin. |
| `carrier_documents` | Metadata for files in the **private** `carrier-documents` bucket (`{carrierId}/{uuid}.ext`). | Owner; admin (signed URLs, 300 s). |
| `freight_rfqs` | Request for quotes per order: route, cargo weight, dates, close time. **No buyer/seller contact details.** | Buyer, seller, admin; eligible carriers while open; carriers that bid. |
| `freight_bids` | Sealed bids, one per (rfq, carrier). | The bidding carrier; the buyer; admin. **Sellers and other carriers never.** |
| `carrier_assignments` | Booked carrier with snapshots (carrier, vehicle, pickup/delivery contacts). | Buyer, seller, admin, the assigned carrier. |

## Verification
`pending → under_review → verified | rejected | suspended` (admin-only via `admin_review_carrier`, audited, notes required for reject/suspend; suspension withdraws live bids). Vehicles are verified by `admin_set_vehicle_verified`; editing plate/payload/type/volume un-verifies the vehicle; editing name/phone of a verified carrier returns it to review. Approval requires at least one verified vehicle.

## Eligibility to see and bid on a load
Verified + available carrier, pickup and destination counties in coverage, a verified active vehicle with `payload_kg*1000 >= cargo_weight_g` (and volume if known), and not a party to the order.

## Selection
`select_freight_bid` (buyer, optimistic version check): accepts one bid, rejects the rest (kept as history), creates the assignment, sets order freight and total, moves the order `freight_requested → carrier_selected` and issues proforma revision 2 with carrier and estimated delivery. `create_freight_rfq` moves `ready_for_freight → freight_requested`; `cancel_freight_rfq` returns it.
