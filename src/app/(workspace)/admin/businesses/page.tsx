import type { Metadata } from "next";
import Link from "next/link";
import { Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { Table, Td, Th } from "@/components/ui/data";
import { BUSINESS_TYPES, VERIFICATION } from "@/features/marketplace/constants";
import { ReviewBusinessButton } from "@/features/admin/components/marketplace-admin";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { cn } from "@/lib/utils/cn";
import { BUSINESS_COLUMNS } from "@/lib/db/columns";
import type { BusinessRow, BusinessType } from "@/lib/db/types";

export const metadata: Metadata = { title: "Businesses · Admin" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unverified", label: "Not verified" },
  { key: "pending", label: "Pending" },
  { key: "verified", label: "Verified" },
  { key: "suspended", label: "Suspended" },
] as const;

export default async function AdminBusinessesPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter: rawFilter } = await searchParams;
  const filter = FILTERS.find((f) => f.key === rawFilter)?.key ?? "all";
  const db = await createSupabaseServerClient();
  let q = db!.from("businesses").select(`${BUSINESS_COLUMNS}, products(count)`).order("created_at", { ascending: false }).limit(200);
  if (filter === "suspended") q = q.neq("status", "active");
  else if (filter !== "all") q = q.eq("verification_status", filter);
  const [{ data }, { data: notes }] = await Promise.all([q, db!.rpc("admin_business_notes")]);
  const noteById = new Map((notes ?? []).map((n) => [n.business_id, n.note]));
  const rows = ((data ?? []) as unknown as (Omit<BusinessRow, "verification_note"> & { products: { count: number }[] })[]).map((b) => ({
    ...b,
    verification_note: noteById.get(b.id) ?? null,
  }));
  const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Monrovia" });

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Marketplace" title="Businesses" description="Verify sellers and suspend businesses that break the rules. Every change is audited." />
      <nav aria-label="Filter" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1 rounded-lg border border-line bg-white p-1">
          {FILTERS.map((f) => (
            <li key={f.key}>
              <Link
                href={f.key === "all" ? "/admin/businesses" : `/admin/businesses?filter=${f.key}`}
                aria-current={filter === f.key ? "page" : undefined}
                className={cn("inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold", filter === f.key ? "bg-trade-900 text-white" : "text-trade-700 hover:bg-trade-50")}
              >
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {rows.length === 0 ? (
        <EmptyState icon={<Store className="size-5" />} title="No businesses here">Businesses appear once sellers create their profile.</EmptyState>
      ) : (
        <Table caption="Businesses">
          <thead>
            <tr>
              <Th>Business</Th>
              <Th>Location</Th>
              <Th>Listings</Th>
              <Th>Status</Th>
              <Th>Joined</Th>
              <Th className="text-right">Action</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const v = VERIFICATION[b.verification_status];
              return (
                <tr key={b.id} className="hover:bg-canvas">
                  <Td>
                    <p className="font-semibold">{b.trading_name}</p>
                    <p className="text-xs text-muted">
                      {BUSINESS_TYPES[b.business_type as BusinessType]}
                      {b.registration_number && <span className="ml-1 font-mono">· Reg {b.registration_number}</span>}
                    </p>
                  </Td>
                  <Td className="text-sm">{b.town}, {b.county}</Td>
                  <Td className="tabular font-mono text-sm">{b.products?.[0]?.count ?? 0}</Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={v.tone}>{v.label}</Badge>
                      {b.status !== "active" && <Badge tone="danger">{b.status}</Badge>}
                    </div>
                  </Td>
                  <Td className="tabular font-mono text-xs text-muted">{dateFmt.format(new Date(b.created_at))}</Td>
                  <Td className="text-right">
                    <ReviewBusinessButton business={b} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
