import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ExternalLink } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/feedback";
import { VERIFICATION } from "@/features/marketplace/constants";
import { BusinessForm } from "@/features/seller/components/business-form";
import { getMyBusiness } from "@/features/seller/queries";

export const metadata: Metadata = { title: "Business profile" };

export default async function SellerBusinessPage() {
  const business = await getMyBusiness();
  const verification = business ? VERIFICATION[business.verification_status] : null;

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        eyebrow="Seller workspace"
        title={business ? "Business profile" : "Set up your business"}
        description={
          business
            ? "This is what buyers see on your seller page and every listing."
            : "Tell buyers who they're trading with. You can list stock as soon as this is saved."
        }
        actions={
          business && business.status === "active" ? (
            <Link href={`/sellers/${business.slug}`} target="_blank" className={buttonClasses("outline", "md")}>
              <ExternalLink className="size-4" aria-hidden="true" /> View seller page
            </Link>
          ) : undefined
        }
      />

      {business && business.status !== "active" && (
        <Alert tone="danger" title="Your business is suspended">
          Your listings are hidden from buyers and can&apos;t be edited. Contact GbanaB2B support.
          {business.verification_note && <> Note from our team: “{business.verification_note}”</>}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card>
          <CardBody className="p-5 sm:p-6">
            <BusinessForm business={business} />
          </CardBody>
        </Card>

        <aside className="space-y-4">
          {business && verification && (
            <Card>
              <CardBody className="space-y-3">
                <p className="label-caps text-muted">Verification</p>
                <Badge tone={verification.tone}>
                  {business.verification_status === "verified" && <BadgeCheck className="size-3.5" aria-hidden="true" />}
                  {verification.label}
                </Badge>
                <p className="text-sm leading-relaxed text-muted">
                  {business.verification_status === "verified"
                    ? "Buyers see a verified badge on your listings."
                    : "The GbanaB2B team reviews businesses and adds a verified badge. Adding your registration number helps."}
                </p>
                {business.verification_status === "rejected" && business.verification_note && (
                  <p className="rounded-md bg-red-50 p-2.5 text-[0.8125rem] text-red-900">{business.verification_note}</p>
                )}
              </CardBody>
            </Card>
          )}
          <Card>
            <CardBody className="text-sm leading-relaxed text-muted">
              <p className="label-caps mb-2 text-muted">Good to know</p>
              Your phone numbers are only shown where you choose. Orders and payments always go through GbanaB2B so both sides
              are protected by escrow.
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
