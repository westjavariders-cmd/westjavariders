import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { recordAdminAction } from "@/lib/admin-audit";
import {
  ensurePricing,
  setPricingStatus,
  validateProductPricing,
} from "@/lib/pricing.functions";
import { NUMERIC_FIELD_TYPES, PRICING_MODES, type ProductPricing } from "@/lib/pricing";
import type { ProductBundle } from "@/lib/catalog";
import { RuleEditor } from "@/components/admin/pricing/RuleEditor";
import { FormulaEditor } from "@/components/admin/pricing/FormulaEditor";
import { TestLab } from "@/components/admin/pricing/TestLab";
import { SeasonSettings } from "@/components/admin/pricing/SeasonSettings";
import { selectClass } from "@/components/admin/configurator/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/** Pricing configuration for one product: mode, base, rules, formula, status, test lab. */
export function PricingTab({
  bundle,
  canEdit,
}: {
  bundle: ProductBundle;
  canEdit: boolean;
}) {
  const productId = bundle.product.id;
  const ensure = useServerFn(ensurePricing);
  const setStatus = useServerFn(setPricingStatus);
  const validate = useServerFn(validateProductPricing);

  const pricingQuery = useQuery({
    queryKey: ["product-pricing", productId],
    queryFn: async () => {
      const { data: pricing, error } = await supabase
        .from("product_pricing")
        .select("*")
        .eq("product_id", productId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!pricing) return { pricing: null, rules: [], tiers: [], versions: [] };

      const [rules, versions] = await Promise.all([
        supabase.from("pricing_rules").select("*").eq("pricing_id", pricing.id).order("display_order"),
        supabase.from("formula_versions").select("*").eq("pricing_id", pricing.id).order("version"),
      ]);
      const ruleIds = (rules.data ?? []).map((r) => r.id);
      const tiers = ruleIds.length
        ? await supabase.from("pricing_tiers").select("*").in("rule_id", ruleIds).order("display_order")
        : { data: [] };
      return {
        pricing: pricing as ProductPricing,
        rules: rules.data ?? [],
        tiers: tiers.data ?? [],
        versions: versions.data ?? [],
      };
    },
  });

  const issuesQuery = useQuery({
    queryKey: ["product-pricing-issues", productId, pricingQuery.dataUpdatedAt],
    queryFn: () => validate({ data: { productId } }),
    enabled: !!pricingQuery.data?.pricing,
  });

  const reload = () => {
    void pricingQuery.refetch();
    void issuesQuery.refetch();
  };

  if (pricingQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const data = pricingQuery.data;

  if (!data?.pricing) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">This product has no pricing yet.</p>
        {canEdit && (
          <Button
            size="sm"
            onClick={async () => {
              try {
                await ensure({ data: { productId } });
                reload();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Pricing could not be created.");
              }
            }}
          >
            Set up pricing
          </Button>
        )}
      </div>
    );
  }

  const pricing = data.pricing;
  const componentRules = data.rules.filter((r) => r.rule_type === "component_quantity");
  const otherRules = data.rules.filter((r) => r.rule_type !== "component_quantity");
  const errors = (issuesQuery.data?.issues ?? []).filter((i) => i.level === "error");
  const warnings = (issuesQuery.data?.issues ?? []).filter((i) => i.level === "warning");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={pricing.status === "active" ? "default" : "secondary"}>
          Pricing {pricing.status}
        </Badge>
        <Badge variant={issuesQuery.data?.purchasable ? "default" : "outline"}>
          {issuesQuery.data?.purchasable ? "Purchasable" : "Not purchasable"}
        </Badge>
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                await setStatus({
                  data: { productId, status: pricing.status === "active" ? "draft" : "active" },
                });
                toast.success("Pricing status updated.");
                reload();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "The status could not be changed.");
              }
            }}
          >
            {pricing.status === "active" ? "Return to draft" : "Activate pricing"}
          </Button>
        )}
      </div>

      {(errors.length > 0 || warnings.length > 0) && (
        <Card>
          <CardContent className="space-y-1 p-4 text-xs">
            {errors.map((i, n) => (
              <p key={`e${n}`} className="text-destructive">
                • {i.message}
              </p>
            ))}
            {warnings.map((i, n) => (
              <p key={`w${n}`} className="text-muted-foreground">
                • {i.message}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <PricingSettings bundle={bundle} pricing={pricing} canEdit={canEdit} reload={reload} />

      {pricing.mode === "structured" ? (
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Component pricing</h3>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={bundle.components.length === 0}
                  onClick={async () => {
                    const { error } = await supabase.from("pricing_rules").insert({
                      pricing_id: pricing.id,
                      label: "New component charge",
                      rule_type: "component_quantity",
                      display_order: data.rules.length,
                    });
                    if (error) {
                      toast.error(error.message);
                      return;
                    }
                    reload();
                  }}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add component
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Each entry charges one of this product's components. The component keeps its own price; here you
              choose how many units are charged and, if needed, when.
            </p>
            {bundle.components.length === 0 && (
              <p className="text-sm text-muted-foreground">
                This product has no components yet — add them on the Components tab first.
              </p>
            )}
            {componentRules.map((rule) => (
              <ComponentPricingEditor
                key={rule.id}
                bundle={bundle}
                rule={rule}
                canEdit={canEdit}
                reload={reload}
              />
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Other pricing rules</h3>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const { error } = await supabase.from("pricing_rules").insert({
                      pricing_id: pricing.id,
                      label: "New rule",
                      rule_type: "fixed",
                      display_order: data.rules.length,
                    });
                    if (error) {
                      toast.error(error.message);
                      return;
                    }
                    reload();
                  }}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add rule
                </Button>
              )}
            </div>
            {otherRules.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No other rules. The price is the base amount plus component charges.
              </p>
            )}
            {otherRules.map((rule) => (
              <RuleEditor
                key={rule.id}
                bundle={bundle}
                rule={rule}
                tiers={data.tiers.filter((t) => t.rule_id === rule.id)}
                canEdit={canEdit}
                reload={reload}
              />
            ))}
          </div>
        </div>
      ) : (
        <FormulaEditor
          bundle={bundle}
          pricing={pricing}
          versions={data.versions}
          canEdit={canEdit}
          reload={reload}
        />
      )}

      <SeasonSettings bundle={bundle} canEdit={canEdit} />

      <TestLab bundle={bundle} pricing={pricing} canEdit={canEdit} />
    </div>
  );
}

/** Mode, base amount, quantity mappings and notes. */
function PricingSettings({
  bundle,
  pricing,
  canEdit,
  reload,
}: {
  bundle: ProductBundle;
  pricing: ProductPricing;
  canEdit: boolean;
  reload: () => void;
}) {
  const [draft, setDraft] = useState({
    mode: pricing.mode as string,
    base_amount_idr: String(pricing.base_amount_idr ?? 0),
    people_variable: pricing.people_variable ?? "",
    days_variable: pricing.days_variable ?? "",
    nights_variable: pricing.nights_variable ?? "",
    sessions_variable: pricing.sessions_variable ?? "",
    notes: pricing.notes ?? "",
  });

  const numeric = bundle.fields.filter((f) => f.is_active && NUMERIC_FIELD_TYPES.includes(f.field_type));

  async function save() {
    const { error } = await supabase
      .from("product_pricing")
      .update({
        mode: draft.mode as ProductPricing["mode"],
        base_amount_idr: Number(draft.base_amount_idr || 0),
        people_variable: draft.people_variable || null,
        days_variable: draft.days_variable || null,
        nights_variable: draft.nights_variable || null,
        sessions_variable: draft.sessions_variable || null,
        notes: draft.notes || null,
      })
      .eq("id", pricing.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await recordAdminAction("pricing_updated", "product_pricing", pricing.id, { mode: draft.mode });
    toast.success("Pricing settings saved.");
    reload();
  }

  const mapping = (
    key: "people_variable" | "days_variable" | "nights_variable" | "sessions_variable",
    label: string,
  ) => (
    <div>
      <Label className="text-[11px]">{label}</Label>
      <select
        className={selectClass}
        value={draft[key]}
        disabled={!canEdit}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      >
        <option value="">Not used</option>
        {numeric.map((f) => (
          <option key={f.id} value={f.variable_name}>
            {f.internal_name} ({f.variable_name})
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Pricing mode</Label>
            <select
              className={selectClass}
              value={draft.mode}
              disabled={!canEdit}
              onChange={(e) => setDraft({ ...draft, mode: e.target.value })}
            >
              {PRICING_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Base amount (Rp)</Label>
            <Input
              value={draft.base_amount_idr}
              disabled={!canEdit}
              onChange={(e) => setDraft({ ...draft, base_amount_idr: e.target.value })}
            />
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium">
            Quantity questions — used for components priced per person, day, night or session
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            {mapping("people_variable", "People")}
            {mapping("days_variable", "Days")}
            {mapping("nights_variable", "Nights")}
            {mapping("sessions_variable", "Sessions")}
          </div>
        </div>

        <div>
          <Label className="text-xs">Internal notes</Label>
          <Input
            value={draft.notes}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </div>

        {canEdit && (
          <Button size="sm" variant="outline" onClick={save}>
            Save pricing settings
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
