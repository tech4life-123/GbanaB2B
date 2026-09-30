# 0012 — Private carrier documents and human verification

**Status:** accepted (Phase 4)

**Context.** Carrier licences, IDs and vehicle papers are sensitive, and the "verified carrier" badge drives trust in bidding.

**Decision.** Documents live in a private bucket `carrier-documents` under `{carrierId}/…`. Owners upload to their own folder; only admins read, through signed URLs that expire in 300 seconds. Verification is a human admin decision (`admin_review_carrier`), audited, with a note required to reject or suspend. AI never approves a carrier. A verified vehicle is required before approval, and material edits send a carrier or vehicle back to review.

**Consequences.** Review is manual and will need a queue SLA in operations. No document is ever public or cached by the service worker.
