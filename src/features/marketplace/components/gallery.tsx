import Image from "next/image";
import { PackageOpen } from "lucide-react";
import { productImageUrl } from "@/lib/storage/images";

/**
 * Swipeable photo strip using CSS scroll-snap — no JavaScript, and photos
 * after the first are lazy-loaded so a 3G visitor only pays for what they see.
 */
export function Gallery({ images, title }: { images: { id: string; storage_path: string; alt_text: string | null }[]; title: string }) {
  if (images.length === 0) {
    return (
      <div className="grid aspect-square place-items-center rounded-lg border border-line bg-trade-50 text-trade-300 sm:aspect-[4/3]">
        <div className="text-center">
          <PackageOpen className="mx-auto size-14" strokeWidth={1} aria-hidden="true" />
          <p className="mt-2 text-sm text-muted">No photos yet</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ul
        className="flex snap-x snap-mandatory overflow-x-auto rounded-lg border border-line bg-trade-50 [scrollbar-width:none]"
        aria-label={`${images.length} photo${images.length === 1 ? "" : "s"} of ${title}`}
      >
        {images.map((img, i) => {
          const src = productImageUrl(img.storage_path);
          return (
            <li key={img.id} id={`photo-${i + 1}`} className="relative aspect-square w-full shrink-0 snap-center sm:aspect-[4/3]">
              {src && (
                <Image
                  src={src}
                  alt={img.alt_text || `${title} — photo ${i + 1}`}
                  fill
                  quality={75}
                  priority={i === 0}
                  sizes="(min-width: 1024px) 560px, 100vw"
                  className="object-contain"
                />
              )}
            </li>
          );
        })}
      </ul>
      {images.length > 1 && (
        <nav aria-label="Photos" className="mt-2 flex gap-2 overflow-x-auto">
          {images.map((img, i) => {
            const src = productImageUrl(img.storage_path);
            return (
              <a
                key={img.id}
                href={`#photo-${i + 1}`}
                className="relative size-14 shrink-0 overflow-hidden rounded-md border border-line bg-trade-50 hover:border-trade-400 sm:size-16"
                aria-label={`Photo ${i + 1}`}
              >
                {src && <Image src={src} alt="" fill quality={60} sizes="64px" className="object-cover" />}
              </a>
            );
          })}
        </nav>
      )}
    </div>
  );
}
