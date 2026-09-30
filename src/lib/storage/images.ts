import { publicEnv } from "@/config/env";

export const PRODUCT_IMAGE_BUCKET = "product-images";
export const MAX_PRODUCT_IMAGES = 8;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** Public URL for a product image path. Returns null when Supabase isn't configured. */
export function productImageUrl(path: string | null | undefined): string | null {
  const base = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  const safe = path.split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${safe}`;
}

/** {business}/{product}/{random}.webp — must match the DB path check. */
export function buildImagePath(businessId: string, productId: string, ext: "webp" | "jpg" | "png" = "webp"): string {
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return `${businessId}/${productId}/${Date.now().toString(36)}-${rand}.${ext}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Server-side guard: a client-supplied path must belong to this business/product. */
export function isValidImagePath(path: string, businessId: string, productId: string): boolean {
  const parts = path.split("/");
  return (
    parts.length === 3 &&
    parts[0] === businessId &&
    parts[1] === productId &&
    UUID.test(parts[0]!) &&
    UUID.test(parts[1]!) &&
    /^[A-Za-z0-9._-]{1,100}$/.test(parts[2]!)
  );
}
