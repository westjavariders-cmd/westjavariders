import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { WEBSITE_CHROME_SETTING_KEYS } from "@/lib/website";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/admin/_app/settings/")({
  component: SettingsPage,
});

function SettingsPage() {
  const { adminSession } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const save = useServerFn(updateSetting);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("key, value, value_type, description")
        .order("key");
      if (error) throw error;
      return data;
    },
  });

  const currencies = useQuery({
    queryKey: ["currencies", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currencies")
        .select("code, name, is_active")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: (vars: { key: string; value: string }) => save({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(`Saved ${vars.key}`);
      setDrafts((d) => {
        const next = { ...d };
        delete next[vars.key];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "This setting could not be saved."),
  });

  return (
    <>
      <PageHeader
        title="Settings"
        description="Global platform configuration. The database is the source of truth."
        breadcrumb={["Admin", "Settings", "General"]}
      />

      {!adminSession.isAdmin && (
        <p className="mb-4 text-sm text-muted-foreground">
          Read-only: only an ADMIN can change settings.
        </p>
      )}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                {adminSession.isAdmin && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.data
                ?.filter((row) => !(WEBSITE_CHROME_SETTING_KEYS as readonly string[]).includes(row.key))
                .map((row) => {
                const draft = drafts[row.key] ?? row.value;
                const dirty = draft !== row.value;
                return (
                  <TableRow key={row.key}>
                    <TableCell className="font-mono text-xs">{row.key}</TableCell>
                    <TableCell>
                      {!adminSession.isAdmin ? (
                        <span className="text-sm">{row.value}</span>
                      ) : row.key === "base_currency" ? (
                        <Select
                          value={draft}
                          onValueChange={(v) => setDrafts((d) => ({ ...d, [row.key]: v }))}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {currencies.data?.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.code} — {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          className="w-40"
                          inputMode={row.value_type === "integer" ? "numeric" : "text"}
                          value={draft}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [row.key]: e.target.value }))
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.value_type}
                    </TableCell>
                    <TableCell className="max-w-xs text-xs text-muted-foreground">
                      {row.description}
                    </TableCell>
                    {adminSession.isAdmin && (
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!dirty || mutation.isPending}
                          onClick={() => mutation.mutate({ key: row.key, value: draft })}
                        >
                          Save
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
