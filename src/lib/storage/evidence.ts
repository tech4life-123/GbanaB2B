/**
 * Dispute evidence. PRIVATE bucket: files are uploaded straight from the
 * browser into `{dispute_id}/{uuid}.{ext}` and read back only through
 * short-lived signed URLs, by the dispute's parties and admins.
 * The database re-checks the path, size and file count.
 */
export const EVIDENCE_BUCKET = "dispute-evidence";
export const MAX_EVIDENCE_IMAGE_BYTES = 6 * 1024 * 1024;
export const MAX_EVIDENCE_VIDEO_BYTES = 25 * 1024 * 1024;
export const EVIDENCE_MIME = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"] as const;
export type EvidenceMime = (typeof EVIDENCE_MIME)[number];

const EXT: Record<EvidenceMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export const isVideoMime = (mime: string) => mime.startsWith("video/");
export const isEvidenceMime = (mime: string): mime is EvidenceMime => (EVIDENCE_MIME as readonly string[]).includes(mime);
export const maxEvidenceBytes = (mime: string) => (isVideoMime(mime) ? MAX_EVIDENCE_VIDEO_BYTES : MAX_EVIDENCE_IMAGE_BYTES);

export function buildEvidencePath(disputeId: string, mime: EvidenceMime, id: string = crypto.randomUUID()): string {
  return `${disputeId}/${id}.${EXT[mime]}`;
}

/** Server-side guard for a client-supplied path. */
export function isValidEvidencePath(path: string, disputeId: string): boolean {
  return new RegExp(`^${UUID}$`, "i").test(disputeId) && new RegExp(`^${disputeId}/${UUID}\\.(jpg|png|webp|mp4|mov)$`, "i").test(path);
}
