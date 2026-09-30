/**
 * Browser-side image preparation: downscale to at most `maxSide` px and
 * re-encode as WebP (JPEG fallback on browsers that can't encode WebP, e.g.
 * older Safari). A typical 4 MB phone photo becomes ~150–300 KB, which is
 * what makes listings usable on 3G.
 */
export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
  ext: "webp" | "jpg";
  contentType: "image/webp" | "image/jpeg";
}

export async function prepareImage(file: File, maxSide = 1600): Promise<PreparedImage> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && file.type !== "") {
    throw new Error("Please choose a JPG, PNG or WebP photo.");
  }
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images.");
  ctx.fillStyle = "#ffffff"; // flatten transparent PNGs onto white
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

  const webp = await toBlob(canvas, "image/webp", 0.8);
  if (webp && webp.type === "image/webp") return { blob: webp, width, height, ext: "webp", contentType: "image/webp" };
  const jpeg = await toBlob(canvas, "image/jpeg", 0.82);
  if (!jpeg) throw new Error("We couldn't process that photo.");
  return { blob: jpeg, width, height, ext: "jpg", contentType: "image/jpeg" };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall through to <img> decoding */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
