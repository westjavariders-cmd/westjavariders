import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Play, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { runPricingTests } from "@/lib/pricing.functions";
import { previewCommercialPrice } from "@/lib/commercial.functions";
import { MONTHS } from "@/lib/commercial";
import type { ProductPricing } from "@/lib/pricing";
import { evaluateDependencies, type PreviewValues, type ProductBundle } from "@/lib/catalog";
import { selectClass } from "@/components/admin/configurator/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Prices a real configuration on the server and keeps a small set of saved
 * cases with an expected total.
 */
export function TestLab({
  bundle,
  pricing,
  canEdit,
}: {
  bundle: ProductBundle;
  pricing: ProductPricing;
  canEdit: boolean;
}) {
  const preview = useServerFn(previewCommercialPrice);
  const runTests = useServerFn(runPricingTests);

  const [values, setValues] = useState<PreviewValues>({});
  const [result, setResult] = useState<Awaited<ReturnType<typeof preview>> | null>(null);
  const [label, setLabel] = useState("");
  const [expected, setExpected] = useState("");
  const [runs, setRuns] = useState<Awaited<ReturnType<typeof runTests>> | null>(null);
  const [month, setMonth] = useState(String(new Date().getUTCMonth() + 1));
  const [promoCode, setPromoCode] = useState("");
  const [isGift, setIsGift] = useState(false);

  const casesQuery = useQuery({
    queryKey: ["pricing-test-cases", pricing.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_test_cases")
        .select("*")
        .eq("pricing_id", pricing.id)
        .order("created_at");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const evaluated = evaluateDependencies(bundle, values);
  const fields = bundle.fields.filter(
    (f) => f.is_active && f.field_type !== "info_block" && !evaluated.fields[f.id]?.hidden,
  );

  const set = (name: string, v: PreviewValues[string]) => setValues({ ...values, [name]: v });

  async function calculate() {
    try {
      const res = await preview({
        data: { productId: bundle.product.id, values: values as Record<string, unknown> },
      });
      setResult(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This price could not be calculated.");
    }
  }

  async function saveCase() {
    const { error } = await supabase.from("pricing_test_cases").insert({
      pricing_id: pricing.id,
      label: label.trim() || "Test case",
      inputs: values as never,
      expected_total_idr: expected === "" ? null : Number(expected),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setLabel("");
    setExpected("");
    void casesQuery.refetch();
    toast.success("Test case saved.");
  }

  async function removeCase(id: string) {
    const { error } = await supabase.from("pricing_test_cases").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void casesQuery.refetch();
  }

  async function runAll() {
    try {
      setRuns(await runTests({ data: { productId: bundle.product.id } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The tests could not be run.");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <h3 className="text-sm font-medium">Try a configuration</h3>
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground">This product has no questions yet.</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => {
              const options = bundle.options.filter((o) => o.field_id === f.id && o.is_active);
              const value = values[f.variable_name];
              return (
                <div key={f.id}>
                  <Label className="text-xs">
                    {f.customer_label || f.internal_name}{" "}
                    <span className="font-mono text-[10px] text-muted-foreground">{f.variable_name}</span>
                  </Label>
                  {f.field_type === "single_select" ? (
                    <select
                      className={selectClass}
                      value={typeof value === "string" ? value : ""}
                      onChange={(e) => set(f.variable_name, e.target.value)}
                    >
                      <option value="">—</option>
                      {options.map((o) => (
                        <option key={o.id} value={o.internal_value}>
                          {o.customer_label || o.internal_value}
                        </option>
                      ))}
                    </select>
                  ) : f.field_type === "multi_select" ? (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {options.map((o) => {
                        const list = Array.isArray(value) ? value : [];
                        const on = list.includes(o.internal_value);
                        return (
                          <Button
                            key={o.id}
                            type="button"
                            size="sm"
                            variant={on ? "default" : "outline"}
                            onClick={() =>
                              set(
                                f.variable_name,
                                on
                                  ? list.filter((x) => x !== o.internal_value)
                                  : [...list, o.internal_value],
                              )
                            }
                          >
                            {o.customer_label || o.internal_value}
                          </Button>
                        );
                      })}
                    </div>
                  ) : f.field_type === "boolean" ? (
                    <div className="mt-1">
                      <Switch
                        checked={value === true}
                        onCheckedChange={(v) => set(f.variable_name, v)}
                      />
                    </div>
                  ) : (
                    <Input
                      className="h-8 text-xs"
                      value={value == null || Array.isArray(value) ? "" : String(value)}
                      onChange={(e) => set(f.variable_name, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <Button size="sm" onClick={calculate}>
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Calculate price
          </Button>

          {result && (
            <div className="space-y-2 rounded-md bg-muted/40 p-3">
              <p className="text-sm font-medium">
                Total: Rp {result.total_idr.toLocaleString("en-US")}{" "}
                <Badge variant={result.purchasable ? "default" : "secondary"}>
                  {result.purchasable ? "purchasable" : "not purchasable"}
                </Badge>
              </p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-destructive">
                  {e}
                </p>
              ))}
              <table className="w-full text-[11px]">
                <tbody>
                  {result.lines.map((l, i) => (
                    <tr key={i} className="border-t border-border/60">
                      <td className="py-1 pr-2">{l.label}</td>
                      <td className="py-1 pr-2 text-muted-foreground">{l.detail}</td>
                      <td className="py-1 text-right font-mono">{l.amount_idr_exact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Saved test cases</h3>
            <Button size="sm" variant="outline" onClick={runAll}>
              Run all
            </Button>
          </div>
          {(casesQuery.data ?? []).map((c) => {
            const run = runs?.find((r) => r.id === c.id);
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2 text-xs">
                <span className="font-medium">{c.label}</span>
                <span className="text-muted-foreground">
                  expected {c.expected_total_idr == null ? "—" : `Rp ${c.expected_total_idr}`}
                </span>
                {run && (
                  <Badge variant={run.passed ? "default" : "destructive"}>
                    {run.passed ? "pass" : `got Rp ${run.actual}`}
                  </Badge>
                )}
                {canEdit && (
                  <Button size="sm" variant="ghost" onClick={() => removeCase(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
          {canEdit && (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label className="text-[11px]">Name</Label>
                <Input
                  className="h-8 text-xs"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="4 people, 3 nights"
                />
              </div>
              <div>
                <Label className="text-[11px]">Expected total (Rp)</Label>
                <Input
                  className="h-8 w-32 text-xs"
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                />
              </div>
              <Button size="sm" variant="outline" onClick={saveCase}>
                Save current inputs
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
