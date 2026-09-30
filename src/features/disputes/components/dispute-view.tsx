import Link from "next/link";
import { ArrowLeft, Scale } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/data";
import { PageHeader } from "@/components/ui/feedback";
import { formatMoney } from "@/lib/money/currency";
import { DISPUTE_KIND, DISPUTE_STATUS, isLiveDispute, PARTY_LABEL } from "@/lib/trust/labels";
import type { DisputeDetail } from "../queries";
import { ResolveForm, StartReviewButton } from "./admin-console";
import { EvidenceList, EvidenceUploader } from "./evidence";
import { MessageForm, WithdrawButton } from "./thread";

const when = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Monrovia" });

const RESOLUTION_COPY: Record<string, string> = {
  refund: "Refunded in full to the buyer.",
  partial_refund: "Partly refunded to the buyer; the rest was released.",
  release: "Not upheld — payment released to the seller and carrier.",
  reject: "Rejected — the order carried on where it was.",
  withdrawn: "Withdrawn by the person who opened it.",
};

/**
 * One dispute for any party or an admin: what was claimed, the conversation,
 * private evidence, and the decision. Admins also get the decision console.
 */
export function DisputeView({
  detail,
  role,
  viewerId,
  maxEvidence,
}: {
  detail: DisputeDetail;
  role: "buyer" | "seller" | "carrier" | "admin";
  viewerId: string;
  maxEvidence: number;
}) {
  const { dispute, messages, evidence, order, escrow } = detail;
  const status = DISPUTE_STATUS[dispute.status];
  const live = isLiveDispute(dispute.status);
  const currency = order?.currency ?? "USD";

  return (
    <div className="animate-fade-in space-y-6">
      <Link href={`/${role}/disputes`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-trade-900">
        <ArrowLeft className="size-4" aria-hidden="true" /> All disputes
      </Link>
      <PageHeader
        eyebrow={`Dispute · ${DISPUTE_KIND[dispute.kind].label}`}
        title={<span className="tabular font-mono">{dispute.dispute_number}</span>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {order && (
              <span>
                Order{" "}
                <Link href={`/${role}/orders/${order.id}`} className="font-mono font-semibold text-trade-800 underline">
                  {order.order_number}
                </Link>
              </span>
            )}
            <span>Opened by the {PARTY_LABEL[dispute.opened_by_role]?.toLowerCase()} · {when.format(new Date(dispute.created_at))}</span>
          </span>
        }
        actions={live && dispute.opened_by === viewerId ? <WithdrawButton disputeId={dispute.id} /> : undefined}
      />

      {live ? (
        <Alert tone="warning" title="Payment is frozen while this is open">
          Nobody is paid or refunded until GbanaB2B decides. Add photos, video and messages so the decision is fair.
        </Alert>
      ) : (
        <Alert tone={dispute.resolution === "release" || dispute.resolution === "reject" ? "info" : "success"} title={RESOLUTION_COPY[dispute.resolution ?? ""] ?? status.label}>
          {dispute.refund_minor ? <>Refunded {formatMoney({ amountMinor: dispute.refund_minor, currency })}. </> : null}
          {dispute.decision_note && <>“{dispute.decision_note}”</>}
          {dispute.decided_at && <span className="mt-1 block text-xs opacity-80">{when.format(new Date(dispute.decided_at))}</span>}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Conversation" />
            <CardBody className="space-y-4">
              <ol className="space-y-3">
                {messages.map((m) => {
                  const mine = m.author_id === viewerId;
                  return (
                    <li key={m.id} className={`max-w-[92%] rounded-lg px-4 py-3 text-sm ${m.author_role === "admin" ? "border border-signal-200 bg-signal-50" : mine ? "ml-auto bg-trade-900 text-white" : "bg-canvas"}`}>
                      <p className={`text-xs font-semibold ${mine && m.author_role !== "admin" ? "text-white/70" : "text-muted"}`}>
                        {PARTY_LABEL[m.author_role] ?? m.author_role} · {when.format(new Date(m.created_at))}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p>
                    </li>
                  );
                })}
              </ol>
              {live && <MessageForm disputeId={dispute.id} />}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Evidence" description="Photos and videos from everyone in this dispute." />
            <CardBody className="space-y-4">
              <EvidenceList items={evidence} />
              {live && <EvidenceUploader disputeId={dispute.id} used={evidence.length} max={maxEvidence} />}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          {(order || dispute.requested_refund_minor) && (
            <Card>
              <CardHeader title="At stake" />
              <CardBody>
                <dl className="space-y-2 text-sm">
                  {escrow && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Held in escrow</dt>
                      <dd className="font-semibold"><MoneyText value={{ amountMinor: escrow.amount_minor, currency }} /></dd>
                    </div>
                  )}
                  {order && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Goods</dt>
                      <dd><MoneyText value={{ amountMinor: order.subtotal_minor, currency }} /></dd>
                    </div>
                  )}
                  {dispute.requested_refund_minor && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Buyer asked for</dt>
                      <dd className="font-semibold"><MoneyText value={{ amountMinor: dispute.requested_refund_minor, currency }} /></dd>
                    </div>
                  )}
                </dl>
              </CardBody>
            </Card>
          )}

          {role === "admin" && live && order && (
            <Card>
              <CardHeader eyebrow="GbanaB2B" title="Decide" action={<Scale className="size-5 text-trade-400" aria-hidden="true" />} />
              <CardBody className="space-y-5">
                {dispute.status === "open" && <StartReviewButton disputeId={dispute.id} />}
                <ResolveForm disputeId={dispute.id} currency={currency} subtotalMinor={order.subtotal_minor} freightMinor={order.freight_minor ?? 0} requestedMinor={dispute.requested_refund_minor} />
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
