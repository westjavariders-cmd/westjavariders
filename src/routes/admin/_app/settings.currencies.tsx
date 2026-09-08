import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { setBaseCurrency } from "@/lib/admin.functions";
import { listFxRates, setFxRate } from "@/lib/fx.functions";
import { recordAdminAction } from "@/lib/admin-audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/_app/settings/currencies")({
  component: CurrenciesPage,
});

type Currency = {
  code: string;
  name: string;
  symbol: string;
  is_base: boolean;
  is_active: boolean;
  display_order: number;
};

function CurrenciesPage() {
  const { adminSession } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const makeBase = useServerFn(setBaseCurrency);
  const [drafts, setDrafts] = useState<Record<string, Partial<Currency>>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [newRow, setNewRow] = useState({ code: "", name: "", symbol: "", display_order: "0" });

  const list = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currencies")
        .select("code, name, symbol, is_base, is_active, display_order")
        .order("display_order");
      if (error) throw error;
      return data as Currency[];
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["currencies"] });
    queryClient.invalidateQueries({ queryKey: ["settings"] });
    queryClient.invalidateQueries({ queryKey: ["audit-log"] });
  }

  const update = useMutation({
    mutationFn: async (vars: { code: string; patch: Partial<Currency> }) => {
      const { error } = await supabase.from("currencies").update(vars.patch).eq("code", vars.code);
      if (error) throw new Error("This change could not be saved.");
      await recordAdminAction("currency_updated", "currencies", vars.code, vars.patch);
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
    mutationFn: async (vars: { code: string; is_active: boolean; is_base: boolean }) => {
      if (vars.is_base && !vars.is_active) {
        throw new Error("The base currency cannot be deactivated.");
      }
      const { error } = await supabase
        .from("currencies")
        .update({ is_active: vars.is_active })
        .eq("code", vars.code);
      if (error) throw new Error("This change could not be saved.");
      await recordAdminAction(
        vars.is_active ? "currency_activated" : "currency_deactivated",
        "currencies",
        vars.code,
        {},
      );
    },
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed."),
  });

  const base = useMutation({
    mutationFn: (code: string) => makeBase({ data: { code } }),
    onSuccess: () => {
      toast.success("Base currency updated");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Change failed."),
  });

  const create = useMutation({
    mutationFn: async () => {
      const code = newRow.code.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) throw new Error("Currency code must be three letters.");
      if (!newRow.name.trim()) throw new Error("A currency name is required.");
      if (!newRow.symbol.trim()) throw new Error("A currency symbol is required.");
      const order = Number(newRow.display_order);
      if (!Number.isInteger(order)) throw new Error("Display order must be a whole number.");
      const { error } = await supabase.from("currencies").insert({
        code,
        name: newRow.name.trim(),
        symbol: newRow.symbol.trim(),
        display_order: order,
      });
      if (error) throw new Error("This currency could not be added. The code may already exist.");
      await recordAdminAction("currency_created", "currencies", code, { name: newRow.name });
    },
    onSuccess: () => {
      toast.success("Currency added");
      setAddOpen(false);
      setNewRow({ code: "", name: "", symbol: "", display_order: "0" });
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add currency."),
  });

  return (
    <>
      <PageHeader
        title="Currencies"
        description="Currencies available to the platform, and the exchange rate used for customer prices."
        breadcrumb={["Admin", "Settings", "Currencies"]}
        actions={
          adminSession.isAdmin ? (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm">Add currency</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add currency</DialogTitle>
                  <DialogDescription>
                    New currencies are added as active and are never the base currency.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="code">Code (3 letters)</Label>
                    <Input
                      id="code"
                      maxLength={3}
                      value={newRow.code}
                      onChange={(e) => setNewRow({ ...newRow, code: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={newRow.name}
                      onChange={(e) => setNewRow({ ...newRow, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="symbol">Symbol</Label>
                    <Input
                      id="symbol"
                      value={newRow.symbol}
                      onChange={(e) => setNewRow({ ...newRow, symbol: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="order">Display order</Label>
                    <Input
                      id="order"
                      inputMode="numeric"
                      value={newRow.display_order}
                      onChange={(e) => setNewRow({ ...newRow, display_order: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => create.mutate()}
                    disabled={create.isPending}
                  >
                    Add
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      {!adminSession.isAdmin && (
        <p className="mb-4 text-sm text-muted-foreground">
          Read-only: only an ADMIN can change currencies.
        </p>
      )}

      <FxRatesCard isAdmin={adminSession.isAdmin} />

      <Card className="mt-6">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Base</TableHead>
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
                  draft.symbol !== row.symbol ||
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
                          className="w-16"
                          value={draft.symbol}
                          onChange={(e) =>
                            setDrafts((d) => ({
                              ...d,
                              [row.code]: { ...d[row.code], symbol: e.target.value },
                            }))
                          }
                        />
                      ) : (
                        row.symbol
                      )}
                    </TableCell>
                    <TableCell>
                      {row.is_base ? (
                        <Badge>Base</Badge>
                      ) : adminSession.isAdmin ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={base.isPending || !row.is_active}
                          onClick={() => base.mutate(row.code)}
                        >
                          Make base
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
                            is_base: row.is_base,
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
                                symbol: draft.symbol,
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

/**
 * Exchange rates. Rupiah is always the base: each rate says how many Rupiah
 * one unit of that currency is worth. Customer prices are converted from the
 * exact Rupiah amount and rounded up once.
 */
function FxRatesCard({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const fetchRates = useServerFn(listFxRates);
  const saveRate = useServerFn(setFxRate);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const rates = useQuery({ queryKey: ["fx-rates"], queryFn: () => fetchRates() });

  const save = useMutation({
    mutationFn: (vars: { code: string; rate: string }) => saveRate({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(`Rate saved for ${vars.code}`);
      setEdits((e) => {
        const next = { ...e };
        delete next[vars.code];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["fx-rates"] });
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "The rate could not be saved."),
  });

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <h2 className="text-sm font-semibold">Exchange rates</h2>
          <p className="text-xs text-muted-foreground">
            How many Rupiah one unit of each currency is worth. Prices are always calculated in
            Rupiah and converted once, rounded up, for display and for the booking record.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Currency</TableHead>
              <TableHead>Rupiah per unit</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Source</TableHead>
              {isAdmin && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.data?.map((row) => {
              const value = edits[row.currency_code] ?? row.rate ?? "";
              const dirty = value.trim() !== (row.rate ?? "");
              return (
                <TableRow key={row.currency_code}>
                  <TableCell className="font-mono text-xs">{row.currency_code}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Input
                        className="w-32"
                        inputMode="decimal"
                        value={value}
                        placeholder="Not set"
                        onChange={(e) =>
                          setEdits((s2) => ({ ...s2, [row.currency_code]: e.target.value }))
                        }
                      />
                    ) : (
                      (row.rate ?? "Not set")
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.effective_at ? new Date(row.effective_at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.source ?? "—"}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!dirty || save.isPending}
                        onClick={() =>
                          save.mutate({ code: row.currency_code, rate: value.trim() })
                        }
                      >
                        Save
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {rates.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} className="text-sm text-muted-foreground">
                  Only Rupiah is active, so no exchange rate is needed.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
