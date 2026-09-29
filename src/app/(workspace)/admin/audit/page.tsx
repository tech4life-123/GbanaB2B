import type { Metadata } from "next";
import { FileClock } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { listRecentAudit } from "@/features/admin/queries";
import { AuditList } from "@/features/admin/components/audit-list";

export const metadata: Metadata = { title: "Audit log · Admin" };

export default async function AdminAuditPage() {
  const entries = await listRecentAudit(100);
  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        eyebrow="Compliance"
        title="Audit log"
        description="Append-only. No one — including administrators and the database's own service role — can edit or delete these records."
      />
      <Card>
        <CardHeader eyebrow="Latest 100" title="Recorded actions" />
        {entries.length ? (
          <AuditList entries={entries} />
        ) : (
          <div className="p-5">
            <EmptyState compact icon={<FileClock className="size-5" />} title="Nothing recorded yet" />
          </div>
        )}
      </Card>
    </div>
  );
}
