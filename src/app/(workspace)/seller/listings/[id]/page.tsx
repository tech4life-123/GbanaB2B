import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/feedback";
import {
  deleteDraftListing,
  saveListingLogistics,
  saveListingPricing,
  saveListingSpecs,
  setListingStatus,
  updateListingBasics,
} from "@/features/seller/actions";
import { ImageManager } from "@/features/seller/components/image-manager";
import { ListingBasicsForm, LogisticsForm, PricingForm, SpecsForm } from "@/features/seller/components/listing-forms";
import { StatusPanel } from "@/features/seller/components/status-panel";
import { getMyBusiness, getMyListing } from "@/features/seller/queries";
import { listCategories } from "@/features/marketplace/queries";
import { fromRows } from "@/lib/pricing/tiers";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const { id } = await params;
  const business = await getMyBusiness();
  if (!business) redirect("/seller/business");
  const [listing, categories, sp] = await Promise.all([getMyListing(id), listCategories(), searchParams]);
  if (!listing || listing.business_id !== business.id) notFound();

  const tiers = fromRows(listing.tiers);
  const editable = business.status === "active" && listing.status !== "archived";
  const readiness = {
    hasWeight: Boolean(listing.unit_weight_g),
    hasTiers: tiers.length > 0,
    tiersMatchMoq: tiers[0]?.minQty === listing.moq,
    hasPhoto: listing.images.length > 0,
    hasDescription: Boolean(listing.description),
  };

  return (
    <div className="animate-fade-in space-y-6">
      <Link href="/seller/listings" className="inline-flex items-center gap-1 text-sm font-semibold text-trade-700 hover:text-trade-900">
        <ArrowLeft className="size-4" aria-hidden="true" /> All listings
      </Link>
      <PageHeader eyebrow={listing.status === "draft" ? "Draft listing" : "Listing"} title={listing.title} description={`Sold per ${listing.unit_label}`} />

      {sp.created && (
        <Alert tone="success" title="Draft created">
          Add prices and the unit weight below, then publish. Photos make listings far more likely to sell.
        </Alert>
      )}
      {sp.error === "delete" && <Alert tone="danger">The draft couldn&apos;t be deleted. Please try again.</Alert>}
      {!editable && (
        <Alert tone="warning" title="Read-only">
          {listing.status === "archived" ? "Archived listings can't be edited." : "Your business is suspended, so listings can't be edited."}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className={editable ? "space-y-6" : "pointer-events-none space-y-6 opacity-60"} aria-disabled={!editable || undefined}>
          <Section id="pricing" title="Prices & stock" description="Minimum order, quantity tiers and how many units you have.">
            <PricingForm
              action={saveListingPricing.bind(null, listing.id)}
              initial={{
                currency: listing.currency,
                moq: listing.moq,
                quantityAvailable: listing.quantity_available,
                tiers: tiers.map((t) => ({ maxQty: t.maxQty, unitPriceMinor: t.unitPriceMinor })),
              }}
            />
          </Section>

          <Section id="photos" title="Photos" description="Show the actual packaging buyers will receive.">
            <ImageManager businessId={business.id} productId={listing.id} images={listing.images} />
          </Section>

          <Section id="shipping" title="Shipping details" description="Carriers are matched and priced from these.">
            <LogisticsForm action={saveListingLogistics.bind(null, listing.id)} initial={listing} />
          </Section>

          <Section id="details" title="Product details">
            <ListingBasicsForm action={updateListingBasics.bind(null, listing.id)} categories={categories} values={listing} submitLabel="Save details" />
          </Section>

          <Section id="specs" title="Specifications" description="Grade, brand, size, shelf life — shown as a table on your listing.">
            <SpecsForm action={saveListingSpecs.bind(null, listing.id)} initial={[...listing.specs].sort((a, b) => a.sort_order - b.sort_order)} />
          </Section>
        </div>

        <aside className="lg:sticky lg:top-6">
          <Card>
            <CardBody>
              <StatusPanel
                status={listing.status}
                slug={listing.slug}
                readiness={readiness}
                statusAction={setListingStatus.bind(null, listing.id)}
                deleteAction={deleteDraftListing.bind(null, listing.id)}
              />
            </CardBody>
          </Card>
          <nav aria-label="Sections" className="mt-4 hidden lg:block">
            <ul className="space-y-1 text-sm">
              {[
                ["pricing", "Prices & stock"],
                ["photos", "Photos"],
                ["shipping", "Shipping details"],
                ["details", "Product details"],
                ["specs", "Specifications"],
              ].map(([href, label]) => (
                <li key={href}>
                  <a href={`#${href}`} className="block rounded-md px-3 py-1.5 text-trade-700 hover:bg-white hover:text-trade-900">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </div>
  );
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader title={title} description={description} />
      <CardBody className="p-5">{children}</CardBody>
    </Card>
  );
}
