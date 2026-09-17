import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { setMasterLanguage } from "@/lib/admin.functions";
import { recordAdminAction } from "@/lib/admin-audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/_app/settings/languages")({
  component: LanguagesPage,
});

type Language = {
  code: string;
  name: string;
  native_name: string | null;
  is_master: boolean;
  is_active: boolean;
  display_order: number;
};

function LanguagesPage() {
  const { adminSession } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const makeMaster = useServerFn(setMasterLanguage);
  const [drafts, setDrafts] = useState<Record<string, Partial<Language>>>({});

  const list = useQuery({
    queryKey: ["languages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("languages")
        .select("code, name, native_name, is_master, is_active, display_order")
        .order("display_order");
      if (error) throw error;
      return data as Language[];
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["languages"] });
    queryClient.invalidateQueries({ queryKey: ["audit-log"] });
  }

  const update = useMutation({
    mutationFn: async (vars: { code: string; patch: Partial<Language> }) => {
      const { error } = await supabase.from("languages").update(vars.patch).eq("code", vars.code);
      if (error) throw new Error("This change could not be saved.");
      await recordAdminAction("language_updated", "languages", vars.code, vars.patch);
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
    mutationFn: async (vars: { code: string; is_active: boolean; is_master: boolean }) => {
      if (vars.is_master && !vars.is_active) {
        throw new Error("The master language cannot be deactivated.");
      }
      const { error } = await supabase
        .from("languages")
        .update({ is_active: vars.is_active })
        .eq("code", vars.code);
      if (error) throw new Error("This change could not be saved.");
      await recordAdminAction(
        vars.is_active ? "language_activated" : "language_deactivated",
        "languages",
        vars.code,
        {},
      );
    },
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed."),
  });

  const master = useMutation({
    mutationFn: (code: string) => makeMaster({ data: { code } }),
    onSuccess: () => {
      toast.success("Master language updated");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Change failed."),
  });

  return (
    <>
      <PageHeader
        title="Languages"
        description="Content languages. Translation and public language switching are later phases."
        breadcrumb={["Admin", "Settings", "Languages"]}
      />

      {!adminSession.isAdmin && (
        <p className="mb-4 text-sm text-muted-foreground">
          Read-only: only an ADMIN can change languages.
        </p>
      )}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Native name</TableHead>
                <TableHead>Master</TableHead>
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
                  (draft.native_name ?? "") !== (row.native_name ?? "") ||
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
                        <Input
                          className="w-40"
                          value={draft.native_name ?? ""}
                          onChange={(e) =>
                            setDrafts((d) => ({
                              ...d,
                              [row.code]: { ...d[row.code], native_name: e.target.value },
                            }))
                          }
                        />
                      ) : (
                        (row.native_name ?? "—")
                      )}
                    </TableCell>
                    <TableCell>
                      {row.is_master ? (
                        <Badge>Master</Badge>
                      ) : adminSession.isAdmin ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={master.isPending || !row.is_active}
                          onClick={() => master.mutate(row.code)}
                        >
                          Make master
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={row.is_active}
                        disabled={!adminSession.isAdmin || toggleActive.isPending}
                        onCheckedChange={(checked) =>
                          toggleActive.mutate({
                            code: row.code,
                            is_active: checked,
                            is_master: row.is_master,
                          })
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
                                native_name: draft.native_name,
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
