import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { formatDate } from "@/features/commerce/components/order-bits";
import { InvoiceDocument } from "@/features/commerce/components/invoice-document";
import { PrintButton } from "@/features/commerce/components/print-button";
import { getOrder, getProforma } from "@/features/commerce/queries";
import { getMyBusiness } from "@/features/seller/queries";
import { requireViewer } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money/currency";
import { whatsappShareUrl } from "@/lib/notifications/types";

export const metadata: Metadata = { title: "Proforma invoice", robots: { index: false } };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer(`/orders/${id}/invoice`);
  // RLS returns nothing unless the viewer is the buyer, a member of the selling business or an admin.
  const [invoice, order] = await Promise.all([getProforma(id), getOrder(id)]);
  if (!invoice || !order) notFound();
  const s = invoice.snapshot;
  const m = (amountMinor: number) => formatMoney({ amountMinor, currency: s.currency });
  const nf = new Intl.NumberFormat("en-US");

  const isBuyer = order.buyer_id === viewer.id;
  const mine = !isBuyer && viewer.roles.includes("seller") ? await getMyBusiness() : null;
  const isSeller = mine?.id === order.seller_business_id;
  const back = isBuyer ? `/buyer/orders/${id}` : isSeller ? `/seller/orders/${id}` : `/admin/orders/${id}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const share = whatsappShareUrl(
    [
      `Proforma invoice ${invoice.invoice_number} (order ${s.order_number})`,
      `${s.seller.name} → ${s.buyer.business_name || s.buyer.name}`,
      ...s.items.map((i) => `• ${i.title} × ${nf.format(i.quantity)} = ${m(i.line_total_minor)}`),
      `Goods total: ${m(s.subtotal_minor)} (freight quoted separately)`,
      `Valid until ${formatDate(s.valid_until)}`,
      `${siteUrl}/orders/${id}/invoice`,
    ].join("\n"),
  );

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <div className="mx-auto flex max-w-[52rem] flex-wrap items-center justify-between gap-3 px-4 py-4 print:hidden">
        <Link href={back} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-trade-900">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to order
        </Link>
        <div className="flex flex-wrap gap-2">
          <a href={share} target="_blank" rel="noopener noreferrer" className={buttonClasses("outline", "md")}>
            <MessageCircle className="size-4" aria-hidden="true" /> Share on WhatsApp
          </a>
          <PrintButton />
        </div>
      </div>

      <main id="main" className="mx-auto max-w-[52rem] px-4 pb-10 print:max-w-none print:p-0">
        <InvoiceDocument invoice={invoice} />
      </main>
    </div>
  );
}
