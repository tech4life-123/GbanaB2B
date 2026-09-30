# Delivery, confirmation and disputes

```
paid_escrow ──carrier picks up──▶ in_transit ──carrier arrives──▶ awaiting_confirmation ──code / buyer / 72 h──▶ completed
     │                                │                                   │
     └──────────── any party opens a dispute ────────────────────────────┘
                              ▼
                          disputed ──withdraw──▶ (back to where it was)
                              └─admin: refund / partial refund / release / reject
```

## Delivery code

1. Pickup creates a random 6-digit code. Only the **buyer** can read it (RLS).
2. The buyer gives it to the carrier **after checking the goods**. The carrier types it in; the database compares.
3. Wrong guesses are counted; after 5 the code locks. The buyer can make a new code, or confirm receipt in the app.
4. Right code → escrow released through `settle_escrow` (seller, carrier, platform shares; balanced ledger; history rows).
5. Silence: if the buyer neither confirms nor disputes within 72 hours of arrival, the sweep releases the payment.

## Tracking

Carriers post a note and, optionally, one approximate location per update (browser geolocation, rounded, at least 120 seconds apart). There is no continuous GPS. Locations open in OpenStreetMap; no map SDK or API key is used.

## Disputes

- Who: the buyer, the seller's team, or the assigned carrier — while money is in escrow (`paid_escrow`, `in_transit`, `awaiting_confirmation`).
- Effect: order → `disputed`; code, buyer confirmation and admin release/refund are frozen.
- Evidence: photos (re-encoded in the browser, location metadata stripped) and short video, uploaded straight to a private bucket, then registered. Evidence is permanent.
- Decision (admin only, written explanation required, audited): full refund, partial refund (seller's or carrier's share pays), release, or reject. Fault is recorded and counts toward trust records.
- The opener may withdraw; the order returns to its prior state.

## Unpaid orders

The buyer or an admin can cancel an unpaid order (stock released, freight request cancelled, payment attempts expired). The nightly sweep does the same after 48 hours. A late provider success on an expired order is parked as `orphan_success` for an admin, never auto-applied.

## Scheduled job

`/api/cron/sweep` (see `vercel.json`, daily 03:00 UTC) calls `sweep_overdue_orders()` with the service role. Requests need `Authorization: Bearer $CRON_SECRET`. Admins can run it from **Admin → Orders → Run housekeeping now**. Vercel Hobby runs cron at most daily, so silent deliveries can be released up to a day late; a Pro plan allows hourly.
