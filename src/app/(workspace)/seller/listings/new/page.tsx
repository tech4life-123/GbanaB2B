import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/feedback";
import { TradePath } from "@/components/brand/trade-path";
import { createListing } from "@/features/seller/actions";
import { ListingBasicsForm } from "@/features/seller/components/listing-forms";
import { getMyBusiness } from "@/features/seller/queries";
import { listCategories } from "@/features/marketplace/queries";

export const metadata: Metadata = { title: "New listing" };

export default async function NewListingPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const business = await getMyBusiness();
  if (!business) redirect("/seller/business");
  if (business.status !== "active") redirect("/seller/business");
  const [categories, sp] = await Promise.all([listCategories(), searchParams]);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="New listing · step 1 of 2" title="What are you selling?" description="Start with the basics. You'll add prices, weight and photos next." />
      {sp.welcome && (
        <Alert tone="success" title={`${business.trading_name} is set up`}>
          Now create your first listing.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <Card>
          <CardBody className="p-5 sm:p-6">
            <ListingBasicsForm action={createListing} categories={categories} submitLabel="Save and continue" primary />
          </CardBody>
        </Card>
        <aside className="hidden lg:block">
          <Card>
            <CardBody>
              <p className="label-caps mb-4 text-muted">Listing checklist</p>
              <TradePath
                orientation="vertical"
                steps={[
                  { key: "1", title: "Basics", detail: "Title, category, unit." },
                  { key: "2", title: "Prices", detail: "MOQ and quantity tiers." },
                  { key: "3", title: "Shipping", detail: "Weight per unit." },
                  { key: "4", title: "Photos", detail: "Up to 8, compressed for you." },
                  { key: "5", title: "Publish", detail: "Goes live on the marketplace.", escrow: true },
                ]}
              />
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
