import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/feedback";
import { AddressCard, AddressForm } from "@/features/commerce/components/address-form";
import { listMyAddresses } from "@/features/commerce/queries";
import { requireRole } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/security/redirect";

export const metadata: Metadata = { title: "Delivery addresses" };

export default async function AddressesPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const viewer = await requireRole("buyer");
  const next = safeNextPath((await searchParams).next, "") || undefined;
  const addresses = await listMyAddresses();

  return (
    <div className="animate-fade-in space-y-6">
      {next && (
        <Link href={next} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-trade-900">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to checkout
        </Link>
      )}
      <PageHeader eyebrow="Buyer" title="Delivery addresses" description="Where carriers drop your stock. Each order keeps a copy of the address it was sent to." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby="saved-heading" className="space-y-3">
          <h2 id="saved-heading" className="text-base font-bold text-trade-900">
            Saved <span className="tabular font-mono text-sm font-normal text-muted">{addresses.length}/20</span>
          </h2>
          {addresses.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line-strong bg-white/60 px-4 py-8 text-center text-sm text-muted">No addresses yet. Add your shop or warehouse.</p>
          ) : (
            <ul className="space-y-3">
              {addresses.map((a) => (
                <AddressCard key={a.id} address={a} />
              ))}
            </ul>
          )}
        </section>

        {addresses.length < 20 && (
          <Card>
            <CardHeader title="Add an address" />
            <CardBody>
              <AddressForm
                key={addresses.length}
                next={next}
                submitLabel={next ? "Save and return to checkout" : "Save address"}
                defaults={addresses.length === 0 ? { contact_name: viewer.profile?.full_name ?? "", contact_phone: viewer.phone ?? "" } : undefined}
              />
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
