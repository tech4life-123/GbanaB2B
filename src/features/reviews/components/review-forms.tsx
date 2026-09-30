"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Eye, Star } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { RATING_LABEL } from "@/lib/trust/labels";
import { adminHideReview, replyToReview, submitReview, type ReviewFormState } from "../actions";

/** Five large, keyboard-reachable radio stars with words, so it works on a phone and with a screen reader. */
function RatingInput({ name, error }: { name: string; error?: string }) {
  const [value, setValue] = useState(0);
  const id = useId();
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-semibold text-trade-900">Rating</legend>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer rounded-md p-1 focus-within:outline-2 focus-within:outline-signal-500">
            <input type="radio" name={name} value={n} className="sr-only" checked={value === n} onChange={() => setValue(n)} aria-label={`${n} — ${RATING_LABEL[n]}`} />
            <Star className={`size-8 ${n <= value ? "fill-signal-500 text-signal-500" : "text-trade-200 hover:text-signal-400"}`} aria-hidden="true" />
          </label>
        ))}
        <span className="ml-2 text-sm font-semibold text-trade-800" aria-live="polite" id={id}>
          {value ? RATING_LABEL[value] : ""}
        </span>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </fieldset>
  );
}

export function ReviewForm({ orderId, subject, subjectName }: { orderId: string; subject: "seller" | "carrier"; subjectName: string }) {
  const router = useRouter();
  const commentId = useId();
  const [state, action, pending] = useActionState<ReviewFormState, FormData>(async (prev, fd) => {
    const r = await submitReview(prev, fd);
    if (r?.ok) router.refresh();
    return r;
  }, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-3 rounded-lg border border-line p-4">
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="subject" value={subject} />
      <p className="text-sm font-semibold text-trade-900">
        Rate the {subject} <span className="font-normal text-muted">· {subjectName}</span>
      </p>
      <RatingInput name="rating" error={errors?.rating} />
      <Field id={commentId} label="Comment" optional hint="What went well or badly? Other buyers will read this." error={errors?.comment}>
        <Textarea id={commentId} name="comment" rows={3} maxLength={1000} />
      </Field>
      {state && !state.ok && !errors && <Alert tone="danger">{state.message}</Alert>}
      <Button type="submit" variant="primary" loading={pending}>
        Post review
      </Button>
      <p className="text-xs text-muted">Reviews can&apos;t be edited or deleted, so they stay honest.</p>
    </form>
  );
}

export function ReplyForm({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const id = useId();
  const [state, action, pending] = useActionState<ReviewFormState, FormData>(async (prev, fd) => {
    const r = await replyToReview(prev, fd);
    if (r?.ok) router.refresh();
    return r;
  }, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="review_id" value={reviewId} />
      <Field id={id} label="Your reply" hint="One public reply per review. It can't be edited." error={state && !state.ok ? state.fieldErrors?.reply : undefined}>
        <Textarea id={id} name="reply" rows={2} required maxLength={1000} />
      </Field>
      {state && !state.ok && !state.fieldErrors && <Alert tone="danger">{state.message}</Alert>}
      <Button type="submit" variant="secondary" size="sm" loading={pending}>
        Post reply
      </Button>
    </form>
  );
}

export function HideReviewButton({ reviewId, hidden }: { reviewId: string; hidden: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function go() {
    setErr(null);
    start(async () => {
      const r = await adminHideReview(reviewId, !hidden, reason);
      if (r.ok) {
        setOpen(false);
        setReason("");
        router.refresh();
      } else setErr(r.message);
    });
  }
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => (hidden ? go() : setOpen(true))} loading={pending && hidden} icon={hidden ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}>
        {hidden ? "Restore" : "Hide"}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Hide this review?" description="It disappears from the public profile and no longer counts toward the rating. The reason is kept in the audit log.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            go();
          }}
        >
          <Field id="hide-reason" label="Reason" hint="For example: contains a phone number, abusive language.">
            <Textarea id="hide-reason" rows={2} required minLength={5} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {err && <Alert tone="danger">{err}</Alert>}
          <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line bg-canvas px-5 py-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Go back
            </Button>
            <Button type="submit" variant="danger" loading={pending}>
              Hide review
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
