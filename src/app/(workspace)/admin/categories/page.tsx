import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/feedback";
import { Table, Td, Th } from "@/components/ui/data";
import { CategoryEditor } from "@/features/admin/components/marketplace-admin";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";

export const metadata: Metadata = { title: "Categories · Admin" };

export default async function AdminCategoriesPage() {
  const db = await createSupabaseServerClient();
  const { data } = await db!.from("product_categories").select("*, products(count)").order("sort_order").order("name");
  const rows = (data ?? []) as unknown as (import("@/lib/db/types").CategoryRow & { products: { count: number }[] })[];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        eyebrow="Marketplace"
        title="Categories"
        description="How buyers browse. Hide a category rather than deleting it — listings keep their category."
        actions={<CategoryEditor />}
      />
      <Table caption="Product categories">
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Slug</Th>
            <Th>Listings</Th>
            <Th>Order</Th>
            <Th>Visibility</Th>
            <Th className="text-right">Edit</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-canvas">
              <Td>
                <p className="font-semibold">{c.name}</p>
                {c.description && <p className="max-w-xs truncate text-xs text-muted">{c.description}</p>}
              </Td>
              <Td className="font-mono text-xs">{c.slug}</Td>
              <Td className="tabular font-mono text-sm">{c.products?.[0]?.count ?? 0}</Td>
              <Td className="tabular font-mono text-sm">{c.sort_order}</Td>
              <Td>{c.is_active ? <Badge tone="escrow">Visible</Badge> : <Badge>Hidden</Badge>}</Td>
              <Td className="text-right">
                <CategoryEditor category={c} />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
