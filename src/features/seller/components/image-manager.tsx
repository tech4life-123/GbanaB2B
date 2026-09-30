"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { createSupabaseBrowserClient } from "@/lib/db/supabase/browser";
import { prepareImage } from "@/lib/storage/compress";
import { buildImagePath, MAX_PRODUCT_IMAGES, MAX_UPLOAD_BYTES, PRODUCT_IMAGE_BUCKET, productImageUrl } from "@/lib/storage/images";
import { cn } from "@/lib/utils/cn";
import { deleteProductImage, makeCoverImage, registerProductImage } from "../actions";

interface Img {
  id: string;
  storage_path: string;
  sort_order: number;
}

/**
 * Upload flow: compress in the browser → upload straight to Supabase Storage
 * (the storage policy only allows this seller's business folder) → register
 * the row through a server action that re-checks the path.
 */
export function ImageManager({ businessId, productId, images }: { businessId: string; productId: string; images: Img[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);
  const remaining = MAX_PRODUCT_IMAGES - sorted.length;

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Uploads aren't available right now.");
    const list = Array.from(files).slice(0, remaining);
    try {
      for (const [i, file] of list.entries()) {
        setBusy(`Preparing photo ${i + 1} of ${list.length}…`);
        const prepared = await prepareImage(file);
        if (prepared.blob.size > MAX_UPLOAD_BYTES) throw new Error("That photo is still too large after compression. Try a smaller one.");
        const path = buildImagePath(businessId, productId, prepared.ext);
        setBusy(`Uploading photo ${i + 1} of ${list.length}…`);
        const { error: upErr } = await supabase.storage
          .from(PRODUCT_IMAGE_BUCKET)
          .upload(path, prepared.blob, { contentType: prepared.contentType, cacheControl: "31536000", upsert: false });
        if (upErr) throw new Error("Upload failed. Check your connection and try again.");
        const res = await registerProductImage(productId, { path, width: prepared.width, height: prepared.height });
        if (!res.ok) throw new Error(res.message);
      }
      if (files.length > remaining) setError(`Only ${MAX_PRODUCT_IMAGES} photos per listing — the extra ones were skipped.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong with the upload.");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
      startTransition(() => router.refresh());
    }
  }

  function run(label: string, fn: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    setBusy(label);
    fn()
      .then((r) => {
        if (!r.ok) setError(r.message ?? "That didn't work.");
      })
      .finally(() => {
        setBusy(null);
        startTransition(() => router.refresh());
      });
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {sorted.map((img, i) => {
          const src = productImageUrl(img.storage_path);
          return (
            <li key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-trade-50">
              {src && <Image src={src} alt={`Photo ${i + 1}`} fill sizes="160px" quality={60} className="object-cover" />}
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 rounded-sm bg-trade-900/90 px-1.5 py-0.5 text-[0.625rem] font-bold text-white">Cover</span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => run("Updating…", () => makeCoverImage(productId, img.id))}
                    className="grid size-8 place-items-center rounded-md bg-white/90 text-trade-900 hover:bg-white"
                    aria-label={`Make photo ${i + 1} the cover`}
                    title="Make cover"
                    disabled={!!busy}
                  >
                    <Star className="size-4" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => run("Removing…", () => deleteProductImage(productId, img.id))}
                  className="grid size-8 place-items-center rounded-md bg-white/90 text-red-700 hover:bg-white"
                  aria-label={`Remove photo ${i + 1}`}
                  title="Remove"
                  disabled={!!busy}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
        {remaining > 0 && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={!!busy}
              className={cn(
                "flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-line-strong text-sm font-semibold text-trade-700 transition-colors hover:border-trade-400 hover:bg-white",
                busy && "cursor-wait opacity-60",
              )}
            >
              {busy ? <Loader2 className="size-6 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-6" aria-hidden="true" />}
              <span className="px-2 text-center text-xs">{busy ? "Working…" : "Add photos"}</span>
            </button>
          </li>
        )}
      </ul>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => onFiles(e.target.files)}
      />
      <p className="text-[0.8125rem] text-muted" aria-live="polite">
        {busy ?? (pending ? "Refreshing…" : `${sorted.length} of ${MAX_PRODUCT_IMAGES} photos. The first photo is the cover. Photos are compressed before upload to save data.`)}
      </p>
    </div>
  );
}
