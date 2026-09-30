import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, BadgeCheck, ChevronRight, Layers, LogIn, MapPin, MessageCircle, Scale, ShoppingCart, Store } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataList } from "@/components/ui/data";
import { BUSINESS_TYPES, ORIGIN_COUNTRIES, PACKAGING, VERIFICATION } from "@/features/marketplace/constants";
import { Gallery } from "@/features/marketplace/components/gallery";
import { ProductGrid } from "@/features/marketplace/components/product-card";
import { QuantityEstimator } from "@/features/marketplace/components/quantity-estimator";
import { AddToCartPanel } from "@/features/commerce/components/add-to-cart";
import { getCartQuantity } from "@/features/commerce/queries";
import { getMyBusiness } from "@/features/seller/queries";
import { getViewer } from "@/lib/auth/session";
import { getPublicProduct, relatedListings } from "@/features/marketplace/queries";
import { formatWeight } from "@/lib/logistics/units";
import { formatMoney } from "@/lib/money/currency";
import { whatsappShareUrl } from "@/lib/notifications/types";
import { fromRows } from "@/lib/pricing/tiers";
import { productImageUrl } from "@/lib/storage/images";
import type { BusinessType } from "@/lib/db/types";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getPublicProduct((await params).slug);
  if (!product) return { title: "Listing not found" };
  const tiers = fromRows(product.tiers);
  const from = tiers.length ? Math.min(...tiers.map((t) => t.unitPriceMinor)) : null;
  const priceText = from ? `From ${formatMoney({ amountMinor: from, currency: product.currency })} per ${product.unit_label}` : "";
  const image = productImageUrl([...product.images].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path);
  return {
    title: product.title,
    description: `${priceText}. Minimum order ${product.moq}. Sold by ${product.business.trading_name}, ${product.business.county}.`,
    openGraph: { title: product.title, description: priceText, images: image ? [{ url: image }] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const product = await getPublicProduct((await params).slug);
  if (!product) notFound();

  const tiers = fromRows(product.tiers);
  const images = [...product.images].sort((a, b) => a.sort_order - b.sort_order);
  const specs = [...product.specs].sort((a, b) => a.sort_order - b.sort_order);
  const [related, buy] = await Promise.all([relatedListings(product.category.slug, product.id), buyState(product.id, product.business.id)]);
  const verification = VERIFICATION[product.business.verification_status];
  const nf = new Intl.NumberFormat("en-US");
  const fromPrice = tiers.length ? Math.min(...tiers.map((t) => t.unitPriceMinor)) : null;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const share = whatsappShareUrl(
    `${product.title} — ${fromPrice ? `from ${formatMoney({ amountMinor: fromPrice, currency: product.currency })} per ${product.unit_label}, ` : ""}min. order ${product.moq}. ${siteUrl}/products/${product.slug}`,
  );

  const dims = [product.length_mm, product.width_mm, product.height_mm].every(Boolean)
    ? `${product.length_mm! / 10} × ${product.width_mm! / 10} × ${product.height_mm! / 10} cm`
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-8">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm">
        <ol className="flex flex-wrap items-center gap-1 text-muted">
          <li>
            <Link href="/marketplace" className="hover:text-trade-900">
              Marketplace
            </Link>
          </li>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <li>
            <Link href={`/marketplace?category=${product.category.slug}`} className="hover:text-trade-900">
              {product.category.name}
            </Link>
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Gallery images={images} title={product.title} />

          {product.description && (
            <Card>
              <CardHeader title="About this product" />
              <CardBody>
                <p className="text-[0.9375rem] leading-relaxed whitespace-pre-line text-trade-800">{product.description}</p>
              </CardBody>
            </Card>
          )}

          {specs.length > 0 && (
            <Card>
              <CardHeader title="Specifications" />
              <CardBody className="py-1">
                <DataList items={specs.map((s) => ({ label: s.label, value: s.value }))} />
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{product.category.name}</Badge>
              {product.quantity_available === 0 ? <Badge tone="danger">Out of stock</Badge> : <Badge tone="escrow">In stock</Badge>}
            </div>
            <h1 className="mt-3 text-2xl leading-tight font-extrabold tracking-tight text-balance text-trade-900 sm:text-3xl">{product.title}</h1>
            <p className="mt-1.5 text-muted">
              Sold per <span className="font-semibold text-trade-900">{product.unit_label}</span>
              {product.sku && <span className="ml-2 font-mono text-xs">· Ref {product.sku}</span>}
            </p>
          </div>

          <div className="grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-white">
            <Fact label="Min. order" value={nf.format(product.moq)} />
            <Fact label="Available" value={product.quantity_available > 0 ? nf.format(product.quantity_available) : "—"} />
            <Fact label="Unit weight" value={formatWeight(product.unit_weight_g)} />
          </div>

          {tiers.length > 0 && buy.mode === "buy" ? (
            <AddToCartPanel
              productId={product.id}
              tiers={tiers}
              currency={product.currency}
              moq={product.moq}
              unitLabel={product.unit_label}
              unitWeightG={product.unit_weight_g}
              available={product.quantity_available}
              inCartQty={buy.inCartQty}
            />
          ) : tiers.length > 0 ? (
            <QuantityEstimator
              tiers={tiers}
              currency={product.currency}
              moq={product.moq}
              unitLabel={product.unit_label}
              unitWeightG={product.unit_weight_g}
              available={product.quantity_available}
            />
          ) : null}

          <div className="space-y-2.5">
            {buy.mode === "signin" && (
              <>
                <ButtonLink href={`/sign-in?next=${encodeURIComponent(`/products/${product.slug}`)}`} size="lg" className="w-full" icon={<LogIn className="size-4" aria-hidden="true" />}>
                  Sign in to order
                </ButtonLink>
                <p className="text-center text-xs text-muted">Free for buyers. The seller confirms stock before you pay anything.</p>
              </>
            )}
            {buy.mode === "role" && (
              <>
                <ButtonLink href="/onboarding?add=buyer" size="lg" className="w-full" icon={<ShoppingCart className="size-4" aria-hidden="true" />}>
                  Start buying on GbanaB2B
                </ButtonLink>
                <p className="text-center text-xs text-muted">Add the buyer role to your account to order wholesale.</p>
              </>
            )}
            {buy.mode === "own" && (
              <Alert tone="info" title="This is your listing" action={<Link href={`/seller/listings/${product.id}`} className="font-semibold underline-offset-2 hover:underline">Edit listing</Link>}>
                Buyers see it exactly like this.
              </Alert>
            )}
            <a href={share} target="_blank" rel="noopener noreferrer" className={`${buttonClasses("outline", "md")} w-full`}>
              <MessageCircle className="size-4" aria-hidden="true" /> Share on WhatsApp
            </a>
          </div>

          <Card>
            <CardBody className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-trade-900 text-signal-400">
                <Store className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="label-caps text-muted">Sold by</p>
                <Link href={`/sellers/${product.business.slug}`} className="text-base font-bold text-trade-900 hover:underline">
                  {product.business.trading_name}
                </Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                  <span>{BUSINESS_TYPES[product.business.business_type as BusinessType] ?? product.business.business_type}</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden="true" /> {product.business.town}, {product.business.county}
                  </span>
                </p>
                <div className="mt-2">
                  <Badge tone={verification.tone}>
                    {product.business.verification_status === "verified" && <BadgeCheck className="size-3.5" aria-hidden="true" />}
                    {verification.label}
                  </Badge>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Shipping details" description="Used to match your order with the right carrier." />
            <CardBody className="py-1">
              <DataList
                items={[
                  { label: "Packaging", value: PACKAGING[product.packaging_type as keyof typeof PACKAGING] ?? product.packaging_type },
                  { label: "Weight per unit", value: <span className="tabular font-mono">{formatWeight(product.unit_weight_g)}</span> },
                  ...(dims ? [{ label: "Dimensions", value: <span className="tabular font-mono">{dims}</span> }] : []),
                  ...(product.unit_volume_cm3
                    ? [{ label: "Volume per unit", value: <span className="tabular font-mono">{nf.format(product.unit_volume_cm3 / 1000)} L</span> }]
                    : []),
                  {
                    label: "Stacking",
                    value: (
                      <span className="inline-flex items-center gap-1.5">
                        <Layers className="size-3.5 text-trade-400" aria-hidden="true" />
                        {product.is_stackable ? (product.max_stack_layers ? `Up to ${product.max_stack_layers} high` : "Stackable") : "Do not stack"}
                      </span>
                    ),
                  },
                  ...(product.is_fragile
                    ? [{ label: "Handling", value: <span className="inline-flex items-center gap-1.5 text-signal-800"><AlertTriangle className="size-3.5" aria-hidden="true" /> Fragile</span> }]
                    : []),
                  ...(product.origin_country ? [{ label: "Origin", value: ORIGIN_COUNTRIES[product.origin_country] ?? product.origin_country }] : []),
                ]}
              />
              {product.handling_notes && (
                <p className="flex gap-2 border-t border-line py-3 text-sm text-trade-800">
                  <Scale className="mt-0.5 size-4 shrink-0 text-trade-400" aria-hidden="true" />
                  {product.handling_notes}
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-14">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 id="related-heading" className="text-xl font-extrabold tracking-tight text-trade-900">
              More in {product.category.name}
            </h2>
            <Link href={`/marketplace?category=${product.category.slug}`} className="text-sm font-semibold text-signal-700 hover:text-signal-800">
              See all
            </Link>
          </div>
          <ProductGrid items={related} />
        </section>
      )}

      <script
        type="application/ld+json"
        // Structured data helps listings show up properly in search engines.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.title,
            description: product.description ?? undefined,
            sku: product.sku ?? undefined,
            image: images.map((i) => productImageUrl(i.storage_path)).filter(Boolean),
            offers: fromPrice
              ? {
                  "@type": "AggregateOffer",
                  priceCurrency: product.currency,
                  lowPrice: (fromPrice / 100).toFixed(2),
                  highPrice: (Math.max(...tiers.map((t) => t.unitPriceMinor)) / 100).toFixed(2),
                  availability: product.quantity_available > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                  seller: { "@type": "Organization", name: product.business.trading_name },
                }
              : undefined,
          }).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}

type BuyState = { mode: "signin" } | { mode: "role" } | { mode: "own" } | { mode: "buy"; inCartQty: number | null };

/** What the order panel should offer this visitor. */
async function buyState(productId: string, businessId: string): Promise<BuyState> {
  const viewer = await getViewer();
  if (!viewer) return { mode: "signin" };
  if (viewer.roles.includes("seller")) {
    const mine = await getMyBusiness();
    if (mine?.id === businessId) return { mode: "own" };
  }
  if (!viewer.roles.includes("buyer")) return { mode: "role" };
  return { mode: "buy", inCartQty: await getCartQuantity(productId) };
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-3 text-center">
      <p className="label-caps !text-[0.625rem] text-muted">{label}</p>
      <p className="tabular mt-1 font-mono text-base font-semibold text-trade-900">{value}</p>
    </div>
  );
}
