"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Archive, Check, CircleDashed, ExternalLink, EyeOff, Rocket, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import type { ProductStatus } from "@/lib/db/types";
import { PRODUCT_STATUS } from "@/features/marketplace/constants";
import type { FormState } from "../actions";
import { FormMessage } from "./form-bits";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export interface Readiness {
  hasWeight: boolean;
  hasTiers: boolean;
  tiersMatchMoq: boolean;
  hasPhoto: boolean;
  hasDescription: boolean;
}

export function StatusPanel({
  status,
  slug,
  readiness,
  statusAction,
  deleteAction,
}: {
  status: ProductStatus;
  slug: string;
  readiness: Readiness;
  statusAction: Action;
  deleteAction: () => Promise<void>;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(statusAction, null);
  const meta = PRODUCT_STATUS[status];
  const canPublish = readiness.hasWeight && readiness.hasTiers && readiness.tiersMatchMoq;

  const checks = [
    { ok: readiness.hasTiers && readiness.tiersMatchMoq, label: "Prices set from your minimum order", required: true },
    { ok: readiness.hasWeight, label: "Weight of one unit", required: true },
    { ok: readiness.hasPhoto, label: "At least one photo", required: false },
    { ok: readiness.hasDescription, label: "A description", required: false },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="label-caps text-muted">Status</p>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>

      {status !== "archived" && (
        <ul className="space-y-2">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2 text-sm">
              {c.ok ? (
                <Check className="mt-0.5 size-4 shrink-0 text-escrow-600" aria-hidden="true" />
              ) : (
                <CircleDashed className={`mt-0.5 size-4 shrink-0 ${c.required ? "text-signal-600" : "text-trade-300"}`} aria-hidden="true" />
              )}
              <span className={c.ok ? "text-trade-700" : "text-trade-900"}>
                {c.label}
                {!c.required && <span className="text-muted"> (recommended)</span>}
                <span className="sr-only">{c.ok ? " — done" : c.required ? " — required" : " — not yet"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <FormMessage state={state} />

      <form action={action} className="grid gap-2">
        {(status === "draft" || status === "paused") && (
          <Button type="submit" name="status" value="active" disabled={!canPublish} loading={pending} icon={<Rocket className="size-4" aria-hidden="true" />}>
            {status === "draft" ? "Publish listing" : "Put back on sale"}
          </Button>
        )}
        {status === "active" && (
          <Button type="submit" name="status" value="paused" variant="outline" loading={pending} icon={<EyeOff className="size-4" aria-hidden="true" />}>
            Pause listing
          </Button>
        )}
        {(status === "active" || status === "paused") && (
          <Button type="submit" name="status" value="archived" variant="ghost" loading={pending} icon={<Archive className="size-4" aria-hidden="true" />}>
            Archive
          </Button>
        )}
      </form>

      {!canPublish && status === "draft" && (
        <p className="text-[0.8125rem] text-muted">Complete the required items to publish.</p>
      )}

      {status === "active" && (
        <Link href={`/products/${slug}`} target="_blank" className={`${buttonClasses("ghost", "sm")} w-full`}>
          <ExternalLink className="size-4" aria-hidden="true" /> View public page
        </Link>
      )}

      {status === "draft" && (
        <form
          action={deleteAction}
          onSubmit={(e) => {
            if (!window.confirm("Delete this draft permanently? This can't be undone.")) e.preventDefault();
          }}
          className="border-t border-line pt-3"
        >
          <Button type="submit" variant="ghost" size="sm" className="w-full text-red-700 hover:bg-red-50" icon={<Trash2 className="size-4" aria-hidden="true" />}>
            Delete draft
          </Button>
        </form>
      )}
      {status === "archived" && (
        <p className="text-[0.8125rem] text-muted">Archived listings stay in your records but can&apos;t be sold again. Create a new listing to sell this item.</p>
      )}
    </div>
  );
}
