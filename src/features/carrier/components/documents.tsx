"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, FileText, Lock, Send, Trash2, Upload } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { createSupabaseBrowserClient } from "@/lib/db/supabase/browser";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/freight";
import { prepareImage } from "@/lib/storage/compress";
import { buildDocumentPath, CARRIER_DOC_BUCKET, MAX_DOCUMENT_BYTES, type DocumentMime } from "@/lib/storage/documents";
import { deleteDocument, openMyDocument, registerDocument, submitForReview } from "../actions";
import type { CarrierDocumentRow, VehicleRow } from "../queries";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Photos are re-encoded in the browser (smaller, EXIF location stripped);
 * PDFs go as-is. Files land in the carrier's own folder of a PRIVATE bucket
 * and are registered by a server action that re-checks the path.
 */
export function DocumentUploader({
  carrierId,
  vehicles,
  documents,
  locked,
}: {
  carrierId: string;
  vehicles: Pick<VehicleRow, "id" | "plate_number">[];
  documents: CarrierDocumentRow[];
  locked: boolean;
}) {
  const router = useRouter();
  const typeId = useId();
  const vehicleId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocumentType>(documents.some((d) => d.doc_type === "driver_license") ? "national_id" : "driver_license");
  const [vehicle, setVehicle] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const needsVehicle = docType === "vehicle_registration" || docType === "vehicle_insurance";

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Uploads aren't available right now.");
    try {
      let blob: Blob = file;
      let mime = file.type as DocumentMime;
      if (file.type.startsWith("image/")) {
        setBusy("Preparing photo…");
        const prepared = await prepareImage(file, 2000);
        blob = prepared.blob;
        mime = prepared.contentType;
      } else if (file.type !== "application/pdf") {
        throw new Error("Upload a photo (JPG, PNG, WebP) or a PDF.");
      }
      if (blob.size > MAX_DOCUMENT_BYTES) throw new Error("That file is over 5 MB. Try a clearer, smaller photo.");
      const path = buildDocumentPath(carrierId, mime);
      setBusy("Uploading securely…");
      const { error: upErr } = await supabase.storage.from(CARRIER_DOC_BUCKET).upload(path, blob, { contentType: mime, upsert: false });
      if (upErr) throw new Error("Upload failed. Check your connection and try again.");
      const res = await registerDocument({
        doc_type: docType,
        vehicle_id: needsVehicle && vehicle ? vehicle : null,
        path,
        file_name: file.name.slice(0, 160) || "document",
        mime_type: mime,
        size_bytes: blob.size,
      });
      if (!res.ok) throw new Error(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong with the upload.");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-md bg-trade-50 px-3 py-2.5 text-[0.8125rem] text-trade-800">
        <Lock className="mt-0.5 size-4 shrink-0 text-trade-500" aria-hidden="true" />
        Stored privately. Only GbanaB2B verification staff can open these files — never buyers, sellers or other carriers.
      </p>

      {documents.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line bg-white">
          {documents.map((d) => (
            <DocumentRow key={d.id} doc={d} locked={locked} plate={vehicles.find((v) => v.id === d.vehicle_id)?.plate_number} />
          ))}
        </ul>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="grid gap-3 rounded-lg border border-dashed border-line-strong bg-white/60 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={typeId} label="Document">
            <Select id={typeId} value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}>
              {(Object.keys(DOCUMENT_TYPES) as DocumentType[]).map((t) => (
                <option key={t} value={t}>
                  {DOCUMENT_TYPES[t].label}
                </option>
              ))}
            </Select>
          </Field>
          {needsVehicle && vehicles.length > 0 && (
            <Field id={vehicleId} label="For vehicle">
              <Select id={vehicleId} value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
                <option value="">Choose…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate_number}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <label className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-trade-900 px-4 text-[0.9375rem] font-semibold whitespace-nowrap text-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-signal-500 hover:bg-trade-800 sm:w-auto">
          <input
            ref={input}
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
            disabled={Boolean(busy)}
          />
          <Upload className="size-4" aria-hidden="true" /> {busy ?? "Choose file"}
        </label>
        <p className="text-xs text-muted sm:col-span-2">{DOCUMENT_TYPES[docType].hint}. Photo or PDF, up to 5 MB. Make sure every corner is visible and the text is sharp.</p>
      </div>
    </div>
  );
}

function DocumentRow({ doc, locked, plate }: { doc: CarrierDocumentRow; locked: boolean; plate?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <FileText className="size-5 shrink-0 text-trade-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-trade-900">
          {DOCUMENT_TYPES[doc.doc_type].label}
          {plate && <span className="font-mono text-xs font-normal text-muted"> · {plate}</span>}
        </p>
        <p className="truncate text-xs text-muted">
          {doc.file_name} · {Math.max(1, Math.round(doc.size_bytes / 1024))} KB · {dateFmt.format(new Date(doc.uploaded_at))}
        </p>
        {error && <p className="text-xs font-medium text-red-700" role="alert">{error}</p>}
      </div>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await openMyDocument(doc.id);
              if (r.ok) window.open(r.data.url, "_blank", "noopener,noreferrer");
              else setError(r.message);
            })
          }
        >
          <Eye className="size-4" aria-hidden="true" /> View
        </Button>
        {!locked && (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted hover:text-red-700"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteDocument(doc.id);
                if (!r.ok) setError(r.message);
              })
            }
          >
            <Trash2 className="size-4" aria-hidden="true" /> Remove
          </Button>
        )}
      </div>
    </li>
  );
}

export function SubmitForReview({ gaps }: { gaps: string[] }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);
  return (
    <div className="space-y-3">
      {gaps.length > 0 ? (
        <ul className="space-y-1 text-sm text-muted">
          {gaps.map((g) => (
            <li key={g}>• {g}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-trade-800">Everything&apos;s in place. Submit and our team will check your documents.</p>
      )}
      {result && <Alert tone={result.ok ? "success" : "danger"}>{result.message}</Alert>}
      <Button
        size="lg"
        disabled={gaps.length > 0}
        loading={pending}
        icon={<Send className="size-4" aria-hidden="true" />}
        onClick={() =>
          start(async () => {
            const r = await submitForReview();
            setResult({ ok: r.ok, message: r.ok ? r.message : r.message });
          })
        }
      >
        Submit for verification
      </Button>
    </div>
  );
}
