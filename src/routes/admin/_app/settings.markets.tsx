import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { recordAdminAction } from "@/lib/admin-audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/admin/_app/settings/markets")({
  component: MarketsPage,
});

type Market = {
  code: string;
  name: string;
  default_currency_code: string;
  default_language_code: string;
  is_active: boolean;
  display_order: number;
};

function MarketsPage() {
  const { adminSession } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Partial<Market>>>({});

  const list = useQuery({
    queryKey: ["markets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("markets")
        .select("code, name, default_currency_code, default_language_code, is_active, display_order")
        .order("display_order");
      if (error) throw error;
      return data as Market[];
    },
  });

  const currencies = useQuery({
    queryKey: ["currencies", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currencies")
        .select("code, name")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const languages = useQuery({
    queryKey: ["languages", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("languages")
        .select("code, name")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["markets"] });
    queryClient.invalidateQueries({ queryKey: ["audit-log"] });
  }

  const update = useMutation({
    mutationFn: async (vars: { code: string; patch: Partial<Market> }) => {
      const { error } = await supabase.from("markets").update(vars.patch).eq("code", vars.code);
      if (error) {
        throw new Error(
          "This change could not be saved. The selected currency or language must exist and be valid.",
        );
      }
      await recordAdminAction("market_updated", "markets", vars.code, vars.patch);
    },
    onSuccess: (_r, vars) => {
      toast.success(`Saved ${vars.code}`);
      setDrafts((d) => {
        const next = { ...d };
        delete next[vars.code];
        return next;
      });
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed."),
  });

  const toggleActive = useMutation({
    mutationFn: async (vars: { code: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("markets")
        .update({ is_active: vars.is_active })
        .eq("code", vars.code);
      if (error) throw new Error("This change could not be saved.");
      await recordAdminAction(
        vars.is_active ? "market_activated" : "market_deactivated",
        "markets",
        vars.code,
        {},
      );
    },
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed."),
  });

  return (
    <>
      <PageHeader
        title="Markets"
        description="Market defaults. Market detection and customer currency selection are later phases."
        breadcrumb={["Admin", "Settings", "Markets"]}
      />

      {!adminSession.isAdmin && (
        <p className="mb-4 text-sm text-muted-foreground">
          Read-only: only an ADMIN can change markets.
        </p>
      )}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Default currency</TableHead>
                <TableHead>Default language</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Order</TableHead>
                {adminSession.isAdmin && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data?.map((row) => {
                const draft = { ...row, ...drafts[row.code] };
                const dirty =
                  draft.name !== row.name ||
                  draft.default_currency_code !== row.default_currency_code ||
                  draft.default_language_code !== row.default_language_code ||
                  draft.display_order !== row.display_order;
                return (
                  <TableRow key={row.code}>
                    <TableCell className="font-mono text-xs">{row.code}</TableCell>
                    <TableCell>
                      {adminSession.isAdmin ? (
                        <Input
                          className="w-40"
                          value={draft.name}
                          onChange={(e) =>
                            setDrafts((d) => ({
                              ...d,
                              [row.code]: { ...d[row.code], name: e.target.value },
                            }))
                          }
                        />
                      ) : (
                        row.name
                      )}
                    </TableCell>
                    <TableCell>
                      {adminSession.isAdmin ? (
                        <Select
                          value={draft.default_currency_code}
                          onValueChange={(v) =>
                            setDrafts((d) => ({
                              ...d,
                              [row.code]: { ...d[row.code], default_currency_code: v },
                            }))
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {currencies.data?.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        row.default_currency_code
                      )}
                    </TableCell>
                    <TableCell>
                      {adminSession.isAdmin ? (
                        <Select
                          value={draft.default_language_code}
                          onValueChange={(v) =>
                            setDrafts((d) => ({
                              ...d,
                              [row.code]: { ...d[row.code], default_language_code: v },
                            }))
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {languages.data?.map((l) => (
                              <SelectItem key={l.code} value={l.code}>
                                {l.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        row.default_language_code
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={row.is_active}
                        disabled={!adminSession.isAdmin || toggleActive.isPending}
                        onCheckedChange={(checked) =>
                          toggleActive.mutate({ code: row.code, is_active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {adminSession.isAdmin ? (
                        <Input
                          className="w-16"
                          inputMode="numeric"
                          value={String(draft.display_order)}
                          onChange={(e) =>
                            setDrafts((d) => ({
                              ...d,
                              [row.code]: {
                                ...d[row.code],
                                display_order: Number(e.target.value) || 0,
                              },
                            }))
                          }
                        />
                      ) : (
                        row.display_order
                      )}
                    </TableCell>
                    {adminSession.isAdmin && (
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!dirty || update.isPending}
                          onClick={() =>
                            update.mutate({
                              code: row.code,
                              patch: {
                                name: draft.name,
                                default_currency_code: draft.default_currency_code,
                                default_language_code: draft.default_language_code,
                                display_order: draft.display_order,
                              },
                            })
                          }
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
