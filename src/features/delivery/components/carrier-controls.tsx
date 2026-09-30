"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag, KeyRound, LocateFixed, MapPin, PackageCheck, TriangleAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { carrierStage, checkpointWaitSeconds, normalizeDeliveryCode, type CarrierStage } from "@/lib/trust/labels";
import { carrierArrived, carrierCheckpoint, carrierConfirmCode, carrierDeliveryFailed, carrierPickUp } from "../actions";

type Msg = { ok: boolean; text: string } | null;

/**
 * Everything a carrier can do on one job, shown for the stage they're in.
 * The code is typed in by the carrier; the database counts wrong tries and
 * locks the code after a few, so guessing can't work.
 */
export function CarrierJobControls({
  orderId,
  delivery,
  lastCheckpointAt,
  checkpointMinSeconds,
  frozen,
}: {
  orderId: string;
  delivery: { picked_up_at: string; arrived_at: string | null; completed_at: string | null } | null;
  lastCheckpointAt: string | null;
  checkpointMinSeconds: number;
  frozen: boolean;
}) {
  const router = useRouter();
  const stage: CarrierStage = carrierStage(delivery);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [shareLocation, setShareLocation] = useState(false);
  const [code, setCode] = useState("");
  const [failOpen, setFailOpen] = useState(false);
  const [failReason, setFailReason] = useState("");
  const noteId = useId();
  const codeId = useId();

  // Live countdown to the next allowed location update: one ticking clock, the wait is derived from it.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  const wait = now === null ? 0 : checkpointWaitSeconds(lastCheckpointAt, checkpointMinSeconds, new Date(now));

  function finish(r: { ok: boolean; message?: string }, after?: () => void) {
    setMsg({ ok: r.ok, text: r.message ?? (r.ok ? "Done." : "Something went wrong.") });
    if (r.ok) {
      after?.();
      router.refresh();
    }
  }

  function getPosition(): Promise<{ lat: number; lng: number } | null> {
    if (!shareLocation || typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
    return new Promise((resolve) =>
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
      ),
    );
  }

  if (frozen) {
    return (
      <Alert tone="warning" title="This delivery is on hold">
        A dispute is open, so pickup, arrival and code entry are paused until GbanaB2B decides. You can add your side in the dispute.
      </Alert>
    );
  }
  if (stage === "completed") return <Alert tone="success" title="Delivered and confirmed">Payment for this job is released to your earnings.</Alert>;

  return (
    <div className="space-y-4">
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}

      {stage === "awaiting_pickup" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">Collect the goods from the seller, then tap below. Pickup only works once the buyer&apos;s payment is held in escrow.</p>
          <Field id={noteId} label="Note" optional hint="For example: 12 cartons loaded.">
            <Input id={noteId} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Button variant="primary" loading={pending} onClick={() => start(async () => finish(await carrierPickUp(orderId, note), () => setNote("")))} icon={<PackageCheck className="size-4" aria-hidden="true" />}>
            I&apos;ve collected the goods
          </Button>
        </div>
      )}

      {stage === "in_transit" && (
        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border border-line p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-trade-900">
              <MapPin className="size-4 text-trade-500" aria-hidden="true" /> Post an update
            </p>
            <Field id={noteId} label="Note" optional hint="For example: Passed Kakata, on schedule.">
              <Input id={noteId} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <label className="flex items-start gap-2 text-sm text-trade-800">
              <input type="checkbox" className="mt-1 size-4 accent-trade-900" checked={shareLocation} onChange={(e) => setShareLocation(e.target.checked)} />
              <span>
                Share my approximate location once <span className="block text-xs text-muted">Only this update, rounded to about 11 m. We never track you continuously.</span>
              </span>
            </label>
            <Button
              variant="outline"
              loading={pending}
              disabled={wait > 0}
              onClick={() =>
                start(async () => {
                  const pos = await getPosition();
                  const r = await carrierCheckpoint(orderId, note, pos?.lat ?? null, pos?.lng ?? null);
                  finish(r.ok && shareLocation && !pos ? { ok: true, message: "Update posted without a location — we couldn't read it." } : r, () => setNote(""));
                })
              }
              icon={<LocateFixed className="size-4" aria-hidden="true" />}
            >
              {wait > 0 ? `Next update in ${wait}s` : "Post update"}
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="primary" loading={pending} onClick={() => start(async () => finish(await carrierArrived(orderId, note), () => setNote("")))} icon={<Flag className="size-4" aria-hidden="true" />}>
              I&apos;ve arrived
            </Button>
            <Button variant="outline" onClick={() => setFailOpen(true)} icon={<TriangleAlert className="size-4" aria-hidden="true" />} className="text-red-800 hover:border-red-300 hover:bg-red-50">
              I can&apos;t deliver
            </Button>
          </div>
        </div>
      )}

      {stage === "arrived" && (
        <div className="space-y-4">
          <form
            className="space-y-3 rounded-lg border border-line p-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await carrierConfirmCode(orderId, code);
                if (r.ok) {
                  setMsg({ ok: r.data.result === "confirmed", text: r.message ?? "" });
                  if (r.data.result === "confirmed") {
                    setCode("");
                    router.refresh();
                  } else if (r.data.result === "locked") router.refresh();
                } else setMsg({ ok: false, text: r.message });
              });
            }}
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-trade-900">
              <KeyRound className="size-4 text-signal-700" aria-hidden="true" /> Enter the buyer&apos;s delivery code
            </p>
            <p className="text-xs text-muted">Ask for it only after they&apos;ve checked the goods. Five wrong tries lock the code.</p>
            <Field id={codeId} label="6-digit code">
              <Input id={codeId} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={7} value={code} onChange={(e) => setCode(normalizeDeliveryCode(e.target.value))} className="text-center font-mono text-xl tracking-[0.3em]" placeholder="••••••" />
            </Field>
            <Button type="submit" variant="escrow" loading={pending} disabled={code.length !== 6}>
              Confirm delivery
            </Button>
          </form>
          <Button variant="outline" size="sm" onClick={() => setFailOpen(true)} className="text-red-800 hover:border-red-300 hover:bg-red-50">
            Something went wrong — report it
          </Button>
        </div>
      )}

      <Dialog open={failOpen} onClose={() => setFailOpen(false)} title="Report a failed delivery" description="Tell the buyer and seller what happened. This doesn't release or refund anything; either side can still open a dispute.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await carrierDeliveryFailed(orderId, failReason);
              finish(r, () => {
                setFailOpen(false);
                setFailReason("");
              });
            });
          }}
        >
          <Field id="fail-reason" label="What happened?" hint="For example: Nobody at the address, phone switched off.">
            <Textarea id="fail-reason" rows={3} minLength={5} maxLength={300} required value={failReason} onChange={(e) => setFailReason(e.target.value)} />
          </Field>
          <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line bg-canvas px-5 py-3">
            <Button variant="ghost" onClick={() => setFailOpen(false)}>
              Go back
            </Button>
            <Button type="submit" variant="danger" loading={pending}>
              Send report
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
