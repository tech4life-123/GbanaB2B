/**
 * Private verification documents. The bucket is NOT public: files are
 * uploaded by the carrier into their own folder and read back only through
 * short-lived signed URLs (admins, and the carrier themselves).
 */
export const CARRIER_DOC_BUCKET = "carrier-documents";
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type DocumentMime = (typeof DOCUMENT_MIME)[number];
export const SIGNED_URL_SECONDS = 300;

const EXT: Record<DocumentMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function extFor(mime: DocumentMime): string {
  return EXT[mime];
}

/** {carrierId}/{uuid}.{ext} — matches the carrier_documents_guard regex. */
export function buildDocumentPath(carrierId: string, mime: DocumentMime): string {
  return `${carrierId}/${crypto.randomUUID()}.${EXT[mime]}`;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Server-side guard for client-supplied paths. */
export function isValidDocumentPath(path: string, carrierId: string): boolean {
  return new RegExp(`^${carrierId}/${UUID}\\.(jpg|png|webp|pdf)$`).test(path) && new RegExp(`^${UUID}$`).test(carrierId);
}
