import Link from "next/link";
import { PackageX } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function MarketNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <EmptyState
        headingLevel={1}
        icon={<PackageX className="size-5" />}
        title="This listing isn't available"
        action={<Link href="/marketplace" className={buttonClasses("secondary", "md")}>Back to the marketplace</Link>}
      >
        It may have been sold out, paused by the seller, or the link may be wrong.
      </EmptyState>
    </div>
  );
}
