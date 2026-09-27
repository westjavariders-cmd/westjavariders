import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { WEBSITE_CHROME_SETTING_KEYS } from "@/lib/website";
import {
  BOOKING_CONDITIONS_MAX_CHARS,
  BOOKING_CONDITIONS_SETTING_KEY,
} from "@/lib/booking-conditions";
import { saveBookingConditions } from "@/lib/booking-conditions.functions";
import { updateSetting } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  const saveConditions = useServerFn(saveBookingConditions);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [conditionsDraft, setConditionsDraft] = useState<string | null>(null);
  const [savingConditions, setSavingConditions] = useState(false);

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

  const storedConditions =
    settings.data?.find((row) => row.key === BOOKING_CONDITIONS_SETTING_KEY)?.value ?? "";

  return (
    <div className="space-y-6">
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
                ?.filter(
                  (row) =>
                    !(WEBSITE_CHROME_SETTING_KEYS as readonly string[]).includes(row.key) &&
                    row.key !== BOOKING_CONDITIONS_SETTING_KEY,
                )
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

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="space-y-1">
            <Label htmlFor="booking-conditions">Booking conditions</Label>
            <p className="text-xs text-muted-foreground">
              Shown in a popup when a guest taps the underlined sentence in the cart. Plain text,
              up to {BOOKING_CONDITIONS_MAX_CHARS.toLocaleString()} characters.
            </p>
          </div>
          <Textarea
            id="booking-conditions"
            rows={16}
            maxLength={BOOKING_CONDITIONS_MAX_CHARS}
            disabled={!adminSession.isAdmin}
            value={conditionsDraft ?? storedConditions}
            onChange={(e) => setConditionsDraft(e.target.value)}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {(conditionsDraft ?? storedConditions).length} / {BOOKING_CONDITIONS_MAX_CHARS}
            </p>
            {adminSession.isAdmin && (
              <Button
                size="sm"
                disabled={
                  savingConditions || (conditionsDraft ?? storedConditions) === storedConditions
                }
                onClick={() => {
                  setSavingConditions(true);
                  void saveConditions({ data: { body: conditionsDraft ?? storedConditions } })
                    .then(() => {
                      toast.success("Booking conditions saved.");
                      setConditionsDraft(null);
                      void queryClient.invalidateQueries({ queryKey: ["settings"] });
                    })
                    .catch((e) =>
                      toast.error(
                        e instanceof Error ? e.message : "The booking conditions could not be saved.",
                      ),
                    )
                    .finally(() => setSavingConditions(false));
                }}
              >
                {savingConditions ? "Saving…" : "Save conditions"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
