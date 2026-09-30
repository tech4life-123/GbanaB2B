"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Eye, FileVideo, ImageIcon, Lock } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createSupabaseBrowserClient } from "@/lib/db/supabase/browser";
import { prepareImage } from "@/lib/storage/compress";
import { buildEvidencePath, EVIDENCE_BUCKET, isEvidenceMime, isVideoMime, maxEvidenceBytes, type EvidenceMime } from "@/lib/storage/evidence";
import { PARTY_LABEL } from "@/lib/trust/labels";
import { openEvidence, registerEvidence } from "../actions";
import type { DisputeEvidenceRow } from "../queries";

const when = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Monrovia" });

/**
 * Photos are re-encoded in the browser (smaller, location metadata stripped);
 * videos go as they are. Files land in this dispute's folder of a PRIVATE
 * bucket. Once registered, evidence can't be deleted by anyone.
 */
export function EvidenceUploader({ disputeId, used, max }: { disputeId: string; used: number; max: number }) {
  const router = useRouter();
  const captionId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const full = used >= max;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Uploads aren't available right now.");
    try {
      let blob: Blob = file;
      let mime: string = file.type;
      if (file.type.startsWith("image/")) {
        setBusy("Preparing photo…");
        const prepared = await prepareImage(file, 1800);
        blob = prepared.blob;
        mime = prepared.contentType;
      }
      if (!isEvidenceMime(mime)) throw new Error("Upload a photo (JPG, PNG, WebP) or a short video (MP4, MOV).");
      if (blob.size > maxEvidenceBytes(mime)) throw new Error(isVideoMime(mime) ? "That video is over 25 MB. Record a shorter clip." : "That photo is over 6 MB. Try a smaller one.");
      const path = buildEvidencePath(disputeId, mime as EvidenceMime);
      setBusy("Uploading securely…");
      const { error: upErr } = await supabase.storage.from(EVIDENCE_BUCKET).upload(path, blob, { contentType: mime, upsert: false });
      if (upErr) throw new Error("Upload failed. Check your connection and try again.");
      const res = await registerEvidence({ dispute_id: disputeId, path, file_name: file.name.slice(0, 160) || "evidence", mime_type: mime, size_bytes: blob.size, caption: caption || undefined });
      if (!res.ok) throw new Error(res.message);
      setCaption("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong with the upload.");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 rounded-md bg-trade-50 px-3 py-2.5 text-[0.8125rem] text-trade-800">
        <Lock className="mt-0.5 size-4 shrink-0 text-trade-500" aria-hidden="true" />
        Private. Only the people in this dispute and GbanaB2B staff can open these files. Evidence can&apos;t be deleted once added, so check each file first.
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      {full ? (
        <p className="text-sm text-muted">This dispute has the maximum of {max} files.</p>
      ) : (
        <div className="grid gap-3 rounded-lg border border-dashed border-line-strong bg-white/60 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field id={captionId} label="Caption" optional hint={`${used} of ${max} files used.`}>
            <Input id={captionId} value={caption} maxLength={300} onChange={(e) => setCaption(e.target.value)} placeholder="For example: cracked cartons at unloading" />
          </Field>
          <div>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" className="sr-only" id={`${captionId}-file`} onChange={(e) => onFile(e.target.files?.[0])} disabled={busy !== null} />
            <Button variant="secondary" loading={busy !== null} onClick={() => input.current?.click()} icon={<Camera className="size-4" aria-hidden="true" />}>
              {busy ?? "Add photo or video"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Evidence list. Files open in a new tab through a link that expires in two minutes. */
export function EvidenceList({ items }: { items: DisputeEvidenceRow[] }) {
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (items.length === 0) return <p className="text-sm text-muted">No photos or videos added yet.</p>;

  async function open(id: string) {
    setError(null);
    setOpening(id);
    const r = await openEvidence(id);
    setOpening(null);
    if (!r.ok) return setError(r.message);
    window.open(r.data.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-2">
      {error && <Alert tone="danger">{error}</Alert>}
      <ul className="divide-y divide-line rounded-lg border border-line bg-white">
        {items.map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-trade-50 text-trade-600">
              {isVideoMime(e.mime_type) ? <FileVideo className="size-4" aria-hidden="true" /> : <ImageIcon className="size-4" aria-hidden="true" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-trade-900">{e.caption || e.file_name}</span>
              <span className="block text-xs text-muted">
                {PARTY_LABEL[e.uploader_role] ?? e.uploader_role} · {when.format(new Date(e.created_at))} · {(e.size_bytes / 1024).toFixed(0)} KB
              </span>
            </span>
            <Button variant="outline" size="sm" loading={opening === e.id} onClick={() => open(e.id)} icon={<Eye className="size-4" aria-hidden="true" />}>
              View
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
