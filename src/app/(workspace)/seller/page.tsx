import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, ExternalLink, PackagePlus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { countOrdersByStatus } from "@/features/commerce/queries";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader, Stat } from "@/components/ui/feedback";
import { SetupChecklist, firstName } from "@/features/workspace/components/dashboard";
import { VERIFICATION } from "@/features/marketplace/constants";
import { countMyListings, getMyBusiness, listMyListings } from "@/features/seller/queries";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Seller workspace" };

export default async function SellerOverviewPage() {
  const [viewer, business] = await Promise.all([getViewer(), getMyBusiness()]);
  const name = viewer?.profile?.display_name || viewer?.profile?.full_name;

  if (!business) {
    return (
      <div className="animate-fade-in space-y-8">
        <PageHeader eyebrow="Seller workspace" title={`Welcome, ${firstName(name)}`} description="List stock by the carton, bag or pallet and sell to retailers across Liberia." />
        <Card className="overflow-hidden">
          <div className="grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <CardBody className="p-6 sm:p-8">
              <span className="grid size-12 place-items-center rounded-lg bg-trade-900 text-signal-400">
                <Building2 className="size-6" aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-xl font-extrabold tracking-tight text-trade-900">First, set up your business</h2>
              <p className="mt-2 max-w-md leading-relaxed text-muted">
                Your business name, type and location appear on every listing. It takes about a minute.
              </p>
              <ButtonLink href="/seller/business" size="lg" className="mt-6" icon={<ArrowRight className="order-last size-5" aria-hidden="true" />}>
                Create business profile
              </ButtonLink>
            </CardBody>
            <div className="bg-manifest hidden p-8 text-white md:block">
              <p className="label-caps text-trade-300">Then</p>
              <ol className="mt-4 space-y-4 text-sm text-trade-100">
                <li>① Add products with MOQs and quantity prices</li>
                <li>② Add weight and photos</li>
                <li>③ Publish — buyers across Liberia can find you</li>
              </ol>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const [counts, recent, orderCounts] = await Promise.all([
    countMyListings(business.id),
    listMyListings(business.id),
    countOrdersByStatus({ scope: "seller", businessId: business.id }),
  ]);
  const newOrders = orderCounts.pending_seller ?? 0;
  const preparing = (orderCounts.confirmed ?? 0) + (orderCounts.fulfilling ?? 0);
  const verification = VERIFICATION[business.verification_status];
  const hasPhoto = recent.some((l) => l.images.length > 0);

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        eyebrow={business.trading_name}
        title={`Welcome, ${firstName(name)}`}
        description="Handle new orders and keep your listings and stock up to date."
        actions={
          <>
            {business.status === "active" && (
              <Link href={`/sellers/${business.slug}`} target="_blank" className={buttonClasses("outline", "md")}>
                <ExternalLink className="size-4" aria-hidden="true" /> Seller page
              </Link>
            )}
            {business.status === "active" && (
              <ButtonLink href="/seller/listings/new" icon={<PackagePlus className="size-4" aria-hidden="true" />}>
                New listing
              </ButtonLink>
            )}
          </>
        }
      />

      {newOrders > 0 && (
        <Alert
          tone="warning"
          title={newOrders === 1 ? "1 new order is waiting for you" : `${newOrders} new orders are waiting for you`}
          action={
            <Link href="/seller/orders" className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline">
              Review orders <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          }
        >
          Check your stock, then accept or cancel with a reason. Buyers see your response straight away.
        </Alert>
      )}

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/seller/orders" className="rounded-lg focus-visible:outline-2 focus-visible:outline-signal-500">
          <Stat label="New orders" value={newOrders} hint="Waiting for you" />
        </Link>
        <Link href="/seller/orders?tab=progress" className="rounded-lg focus-visible:outline-2 focus-visible:outline-signal-500">
          <Stat label="Preparing" value={preparing} hint="Accepted, stock reserved" />
        </Link>
        <Stat label="Live listings" value={counts.active} tone="escrow" hint="Visible to buyers" />
        <Stat label="Drafts" value={counts.draft} hint={counts.paused ? `${counts.paused} paused` : "Not yet published"} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            eyebrow="Catalogue"
            title="Recently updated"
            action={
              <Link href="/seller/listings" className="inline-flex items-center gap-1 text-sm font-semibold text-trade-700 hover:text-trade-900">
                All listings <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            }
          />
          {recent.length ? (
            <ul className="divide-y divide-line">
              {recent.slice(0, 5).map((l) => (
                <li key={l.id}>
                  <Link href={`/seller/listings/${l.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-trade-900">{l.title}</span>
                      <span className="text-xs text-muted">per {l.unit_label}</span>
                    </span>
                    <Badge tone={l.status === "active" ? "escrow" : l.status === "paused" ? "signal" : "neutral"}>
                      {l.status === "active" ? "Live" : l.status[0]!.toUpperCase() + l.status.slice(1)}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody>
              <p className="text-sm text-muted">No listings yet.</p>
              <ButtonLink href="/seller/listings/new" className="mt-4" size="sm">
                Create your first listing
              </ButtonLink>
            </CardBody>
          )}
        </Card>

        <div className="space-y-6">
          <SetupChecklist
            title="Get ready to sell"
            items={[
              { label: "Create your business profile", done: true },
              { label: "Publish your first listing", done: counts.active > 0, href: "/seller/listings/new" },
              { label: "Add photos to a listing", done: hasPhoto, href: "/seller/listings" },
              { label: "Get verified by GbanaB2B", detail: "Add your registration number to speed this up.", done: business.verification_status === "verified", href: "/seller/business" },
              { label: "Set your payout wallet", done: false, phase: 5 },
            ]}
          />
          <Card>
            <CardBody className="flex items-center justify-between gap-3">
              <div>
                <p className="label-caps text-muted">Verification</p>
                <p className="mt-1 text-sm font-semibold text-trade-900">{verification.label}</p>
              </div>
              {business.verification_status === "verified" ? (
                <BadgeCheck className="size-6 text-escrow-600" aria-hidden="true" />
              ) : (
                <Link href="/seller/business" className="text-sm font-semibold text-signal-700 hover:text-signal-800">
                  Details
                </Link>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
