# 0008 — Listing photos in a public bucket; sensitive files never

**Status:** Accepted (Phase 2)

**Decision.** Product photos live in the public `product-images` bucket so they can be served through Next.js image optimisation and CDN caching without signed URLs. Writes are restricted by storage RLS to `{business_id}/…` folders the caller can edit; the DB re-validates paths.

**Never public:** verification documents, IDs, licences, dispute evidence. Those go in private buckets with signed URLs for authorised admins only (Phase 4/6).

**Consequences.** Anyone with a URL can view a listing photo, including photos of paused listings; sellers are told photos are public. Deleting a photo removes both the row and the object.
