import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/_app/settings/audit")({
  component: AuditPage,
});

function AuditPage() {
  const log = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("id, created_at, actor_id, action, entity_type, entity_ref, details")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Important Admin actions. Entries cannot be edited or deleted."
        breadcrumb={["Admin", "Settings", "Audit log"]}
      />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    No entries yet.
                  </TableCell>
                </TableRow>
              )}
              {log.data?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(row.created_at).toLocaleString("en-GB", { timeZone: "UTC" })} UTC
                  </TableCell>
                  <TableCell className="font-mono text-[11px]">
                    {row.actor_id ? row.actor_id.slice(0, 8) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{row.action}</TableCell>
                  <TableCell className="text-xs">{row.entity_type}</TableCell>
                  <TableCell className="text-xs">{row.entity_ref ?? "—"}</TableCell>
                  <TableCell className="max-w-xs truncate font-mono text-[11px] text-muted-foreground">
                    {JSON.stringify(row.details)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
