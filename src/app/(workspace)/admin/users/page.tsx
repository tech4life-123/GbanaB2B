import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/data";
import { listUsers } from "@/features/admin/queries";
import { ROLE_META } from "@/lib/auth/roles";
import { formatPhoneForDisplay } from "@/lib/validation/phone";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Users · Admin" };

const joinedFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Monrovia" });

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const { users, total, pageSize } = await listUsers({ page });
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        eyebrow="People"
        title="Users & roles"
        description={`${new Intl.NumberFormat("en-US").format(total)} accounts. Role changes are made through audited database functions.`}
      />

      {users.length === 0 ? (
        <EmptyState icon={<Users className="size-5" />} title="No accounts yet">
          Accounts appear here as soon as someone signs in with their phone number.
        </EmptyState>
      ) : (
        <>
          <Table caption="Registered users">
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Phone</Th>
                <Th>Roles</Th>
                <Th>Status</Th>
                <Th className="text-right">Joined</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-canvas">
                  <Td>
                    <p className="font-semibold">{u.full_name ?? <span className="text-muted italic">Not set</span>}</p>
                    <p className="font-mono text-[0.6875rem] text-muted">{u.id.slice(0, 8)}</p>
                  </Td>
                  <Td className="tabular font-mono text-[0.8125rem]">{u.phone ? formatPhoneForDisplay(u.phone) : "—"}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length ? (
                        u.roles.map((r) => (
                          <Badge key={r} tone={r === "admin" ? "gold" : "neutral"}>
                            {ROLE_META[r].label}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted">Onboarding</span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={u.status === "active" ? "escrow" : "danger"}>{u.status}</Badge>
                  </Td>
                  <Td className="tabular text-right font-mono text-[0.8125rem] text-muted">{joinedFmt.format(new Date(u.created_at))}</Td>
                </tr>
              ))}
            </tbody>
          </Table>

          {pages > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-between">
              <p className="text-sm text-muted">
                Page {page} of {pages}
              </p>
              <div className="flex gap-2">
                <Link
                  href={`/admin/users?page=${page - 1}`}
                  aria-disabled={page <= 1}
                  tabIndex={page <= 1 ? -1 : undefined}
                  className={buttonClasses("outline", "sm")}
                >
                  Previous
                </Link>
                <Link
                  href={`/admin/users?page=${page + 1}`}
                  aria-disabled={page >= pages}
                  tabIndex={page >= pages ? -1 : undefined}
                  className={buttonClasses("outline", "sm")}
                >
                  Next
                </Link>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
