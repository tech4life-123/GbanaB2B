import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { OrderStatus } from "@/lib/orders/state";
import type { getOrderReviewStatus } from "../queries";
import { ReviewForm } from "./review-forms";
import { Stars } from "./stars";

type Done = Awaited<ReturnType<typeof getOrderReviewStatus>>;

/** Buyer-only, after the order is complete: rate the seller and the carrier once each. */
export function ReviewPanel({
  order,
  done,
  sellerName,
  carrierName,
}: {
  order: { id: string; status: OrderStatus };
  done: Done;
  sellerName: string;
  carrierName: string | null;
}) {
  if (order.status !== "completed" && order.status !== "partially_refunded") return null;
  const subjects = [
    { kind: "seller" as const, name: sellerName },
    ...(carrierName ? [{ kind: "carrier" as const, name: carrierName }] : []),
  ];
  return (
    <Card>
      <CardHeader eyebrow="Reviews" title="How did it go?" description="Your ratings help other buyers choose sellers and carriers. You can review for 30 days after delivery." />
      <CardBody className="space-y-4">
        {subjects.map((s) => {
          const mine = done.find((d) => d.subject_kind === s.kind);
          if (!mine) return <ReviewForm key={s.kind} orderId={order.id} subject={s.kind} subjectName={s.name} />;
          return (
            <div key={s.kind} className="rounded-lg border border-line p-4">
              <p className="text-sm font-semibold text-trade-900">
                Your review of the {s.kind} <span className="font-normal text-muted">· {s.name}</span>
              </p>
              <div className="mt-1">
                <Stars value={mine.rating} />
              </div>
              {mine.comment && <p className="mt-2 text-sm text-trade-800">“{mine.comment}”</p>}
              {mine.reply && (
                <p className="mt-3 rounded-md bg-canvas px-3 py-2 text-sm">
                  <span className="label-caps block text-muted">Reply from the {s.kind}</span>
                  {mine.reply}
                </p>
              )}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
