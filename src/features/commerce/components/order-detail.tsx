import Link from "next/link";
import { ArrowLeft, FileText, MessageSquareText, Route, Store, User } from "lucide-react";
import { StageTracker } from "@/components/brand/trade-path";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { MoneyText, Table, Td, Th } from "@/components/ui/data";
import { formatWeight, carrierClassFor } from "@/lib/logistics/units";
import { formatBps } from "@/lib/money/currency";
import { availableActions, ORDER_STAGES, ORDER_STATUS, stageIndex, type OrderActor } from "@/lib/orders/state";
import type { OrderDetail } from "../queries";
import { OrderActions } from "./order-actions";
import { AddressBlock, formatDate, formatDateTime, OrderStatusBadge, SummaryRow } from "./order-bits";

const ACTOR_LABEL: Record<string, string> = { buyer: "Buyer", seller: "Seller", carrier: "Carrier", admin: "GbanaB2B admin", system: "System" };

/**
 * One order, seen by the buyer, the seller or an admin. Everything shown is the
 * snapshot taken when the order was placed — later listing edits never change it.
 */
export function OrderDetailView({
  order,
  perspective,
  backHref,
  cancelWindowMinutes,
  notice,
  freight,
  payment,
  delivery,
  trust,
}: {
  order: OrderDetail;
  perspective: OrderActor;
  backHref: string;
  cancelWindowMinutes: number;
  notice?: React.ReactNode;
  /** Freight section (Phase 4), rendered under the status card. */
  freight?: React.ReactNode;
  /** Payment and escrow section (Phase 5), rendered under freight. */
  payment?: React.ReactNode;
  /** Delivery tracking, code and confirmation (Phase 6). */
  delivery?: React.ReactNode;
  /** Disputes and reviews (Phase 6), rendered under payment. */
  trust?: React.ReactNode;
}) {
  const meta = ORDER_STATUS[order.status];
  const actions = availableActions(order.status, perspective, { placedAt: order.placed_at, cancelWindowMinutes });
  const idx = stageIndex(order.status);
  const money = (amountMinor: number) => <MoneyText value={{ amountMinor, currency: order.currency }} />;
  const nf = new Intl.NumberFormat("en-US");
  const proforma = order.proformas[0];
  const buyerName = order.buyer_snapshot.business_name || order.buyer_snapshot.name;
  const proceeds = order.subtotal_minor - order.platform_fee_minor;
  const hint = perspective === "buyer" ? meta.buyerHint : meta.sellerHint;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-trade-900">
          <ArrowLeft className="size-4" aria-hidden="true" /> All orders
        </Link>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label-caps text-signal-700">Order</p>
            <h1 className="tabular mt-1 font-mono text-2xl font-bold tracking-tight text-trade-900 sm:text-[1.75rem]">{order.order_number}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <OrderStatusBadge status={order.status} />
              <span>Placed {formatDateTime(order.placed_at)}</span>
            </p>
          </div>
          {proforma && (
            <ButtonLink href={`/orders/${order.id}/invoice`} variant="outline" icon={<FileText className="size-4" aria-hidden="true" />}>
              Proforma invoice
            </ButtonLink>
          )}
        </div>
      </div>

      {notice}

      <Card>
        <CardBody className="space-y-5">
          {idx >= 0 ? (
            <StageTracker stages={[...ORDER_STAGES]} currentIndex={idx} />
          ) : (
            <Alert tone="danger" title={`Cancelled${order.cancelled_by ? ` by ${ACTOR_LABEL[order.cancelled_by]?.toLowerCase() ?? order.cancelled_by}` : ""}`}>
              {order.cancellation_reason ? <>Reason: {order.cancellation_reason}</> : "No reason was given."}
              {order.cancelled_at && <span className="block text-xs opacity-80">{formatDateTime(order.cancelled_at)}</span>}
            </Alert>
          )}
          {idx >= 0 && (
            <div className="rounded-md bg-canvas px-4 py-3">
              <p className="text-sm font-semibold text-trade-900">{meta.label}</p>
              <p className="mt-0.5 text-sm text-muted">{hint}</p>
            </div>
          )}
          <OrderActions orderId={order.id} version={order.version} actions={actions} />
          {perspective === "buyer" && order.status === "confirmed" && actions.length > 0 && (
            <p className="text-xs text-muted">You can cancel for free within {cancelWindowMinutes} minutes of placing the order.</p>
          )}
        </CardBody>
      </Card>

      {freight}
      {payment}
      {delivery}
      {trust}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section aria-labelledby="items-heading" className="space-y-3">
            <h2 id="items-heading" className="text-base font-bold text-trade-900">
              Items <span className="font-normal text-muted">· prices locked when the order was placed</span>
            </h2>
            <Table caption="Order items">
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Unit price</Th>
                  <Th className="text-right">Line total</Th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((i) => {
                  const slug = i.product_id ? order.productSlugs[i.product_id] : undefined;
                  return (
                    <tr key={i.id}>
                      <Td>
                        {slug ? (
                          <Link href={`/products/${slug}`} className="font-semibold hover:underline">
                            {i.title}
                          </Link>
                        ) : (
                          <span className="font-semibold">{i.title}</span>
                        )}
                        <span className="block text-xs text-muted">
                          per {i.unit_label}
                          {i.sku && <span className="font-mono"> · {i.sku}</span>} · {formatWeight(i.unit_weight_g * i.quantity)}
                        </span>
                      </Td>
                      <Td className="tabular text-right font-mono">{nf.format(i.quantity)}</Td>
                      <Td className="text-right">{money(i.unit_price_minor)}</Td>
                      <Td className="text-right font-semibold">{money(i.line_total_minor)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </section>

          <Card>
            <CardHeader title="Totals" />
            <CardBody>
              <dl className="divide-y divide-line">
                <SummaryRow label={`Goods subtotal · ${order.item_count} ${order.item_count === 1 ? "line" : "lines"}`}>{money(order.subtotal_minor)}</SummaryRow>
                <SummaryRow label="Freight" muted>
                  {order.freight_minor !== null ? money(order.freight_minor) : <span className="text-sm text-muted">Quoted by carriers</span>}
                </SummaryRow>
                <SummaryRow label="Total so far" strong>
                  {money(order.total_minor)}
                </SummaryRow>
                {perspective !== "buyer" && (
                  <>
                    <SummaryRow label={`Platform fee (${formatBps(order.platform_fee_bps)} of goods)`} muted>
                      − {money(order.platform_fee_minor)}
                    </SummaryRow>
                    <SummaryRow label="Seller proceeds">{money(proceeds)}</SummaryRow>
                  </>
                )}
              </dl>
              <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-muted">
                Cargo {formatWeight(order.total_weight_g)} · {carrierClassFor(order.total_weight_g)} carrier class.{" "}
                {perspective === "buyer"
                  ? "The platform fee is paid by the seller, not added to your total."
                  : "The fee is deducted from the seller's proceeds when escrow is released."}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="History" />
            <CardBody>
              <ol className="relative space-y-4 border-l-2 border-line pl-5">
                {order.history.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute top-1.5 -left-[1.6875rem] size-3 rounded-full bg-trade-900 ring-4 ring-white" aria-hidden="true" />
                    <p className="text-sm font-semibold text-trade-900">{h.from_status === null ? "Order placed" : ORDER_STATUS[h.to_status].label}</p>
                    <p className="text-xs text-muted">
                      {ACTOR_LABEL[h.actor_role] ?? h.actor_role} · {formatDateTime(h.created_at)}
                    </p>
                    {h.note && h.note !== "Order placed" && <p className="mt-1 text-sm text-trade-800">“{h.note}”</p>}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Delivery" />
            <CardBody className="space-y-3">
              <p className="label-caps text-muted">{order.delivery_address.label}</p>
              <AddressBlock address={order.delivery_address} />
              <div className="flex gap-2 rounded-md bg-canvas p-3 text-xs text-muted">
                <Route className="size-4 shrink-0 text-trade-400" aria-hidden="true" />
                Verified carriers bid for this delivery once the order is ready for pickup.
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-4">
              <Party icon={<Store className="size-4" aria-hidden="true" />} label="Seller">
                {perspective === "buyer" ? (
                  <Link href={`/sellers/${order.seller_snapshot.slug}`} className="font-semibold text-trade-900 hover:underline">
                    {order.seller_snapshot.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-trade-900">{order.seller_snapshot.name}</span>
                )}
                <span className="block text-sm text-muted">
                  {order.seller_snapshot.town}, {order.seller_snapshot.county}
                </span>
                {order.seller_snapshot.phone && <span className="tabular block font-mono text-sm">{order.seller_snapshot.phone}</span>}
              </Party>
              <Party icon={<User className="size-4" aria-hidden="true" />} label="Buyer">
                <span className="font-semibold text-trade-900">{buyerName}</span>
                {order.buyer_snapshot.business_name && <span className="block text-sm text-muted">{order.buyer_snapshot.name}</span>}
                {order.buyer_snapshot.phone && <span className="tabular block font-mono text-sm">{order.buyer_snapshot.phone}</span>}
              </Party>
              {order.buyer_note && (
                <Party icon={<MessageSquareText className="size-4" aria-hidden="true" />} label="Buyer's note">
                  <span className="text-sm text-trade-800">{order.buyer_note}</span>
                </Party>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Proforma invoice" />
            <CardBody className="text-sm">
              {proforma ? (
                <div className="space-y-3">
                  <p>
                    <span className="tabular font-mono font-semibold text-trade-900">{proforma.invoice_number}</span>
                    <span className="block text-xs text-muted">
                      Revision {proforma.revision} · issued {formatDate(proforma.issued_at)}
                    </span>
                  </p>
                  <ButtonLink href={`/orders/${order.id}/invoice`} variant="secondary" size="sm" icon={<FileText className="size-4" aria-hidden="true" />}>
                    View, print or share
                  </ButtonLink>
                </div>
              ) : order.status === "cancelled" ? (
                <p className="text-muted">No invoice — the order was cancelled before the seller accepted it.</p>
              ) : (
                <p className="text-muted">Issued automatically when the seller accepts the order.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Party({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-trade-50 text-trade-600">{icon}</span>
      <div className="min-w-0">
        <p className="label-caps text-muted">{label}</p>
        {children}
      </div>
    </div>
  );
}
