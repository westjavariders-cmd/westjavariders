import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { getSeasonConfig, saveSeasonConfig } from "@/lib/commercial.functions";
import { MONTHS, SEASON_PERIODS, isDiscountableKind, type SeasonPeriod } from "@/lib/commercial";
import type { ProductBundle } from "@/lib/catalog";
import { selectClass } from "@/components/admin/configurator/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";

/** Seasonal pricing for one product: off by default, never inherited. */
export function SeasonSettings({ bundle, canEdit }: { bundle: ProductBundle; canEdit: boolean }) {
  const productId = bundle.product.id;
  const load = useServerFn(getSeasonConfig);
  const save = useServerFn(saveSeasonConfig);

  const query = useQuery({
    queryKey: ["product-season", productId],
    queryFn: () => load({ data: { productId } }),
  });

  const [enabled, setEnabled] = useState(false);
  const [discounts, setDiscounts] = useState<Record<SeasonPeriod, string>>({
    HIGH: "0",
    MID: "0",
    LOW: "0",
  });
  const [months, setMonths] = useState<Record<number, SeasonPeriod>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const data = query.data;
    if (!data) return;
    setEnabled(data.settings?.enabled === true);
    const d: Record<SeasonPeriod, string> = { HIGH: "0", MID: "0", LOW: "0" };
    for (const p of data.periods) d[p.period as SeasonPeriod] = String(p.discount_percentage);
    setDiscounts(d);
    const m: Record<number, SeasonPeriod> = {};
    for (const row of data.months) m[row.month] = row.period as SeasonPeriod;
    setMonths(m);
  }, [query.data]);

  if (!isDiscountableKind(bundle.product.kind as string)) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Insurance never carries a season or a promotion.
        </CardContent>
      </Card>
    );
  }

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const issues = query.data?.issues ?? [];

  async function submit() {
    setBusy(true);
    try {
      await save({
        data: {
          productId,
          enabled,
          discounts: {
            HIGH: 0,
            MID: Number(discounts.MID || 0),
            LOW: Number(discounts.LOW || 0),
          },
          months: Object.entries(months)
            .filter(([, period]) => !!period)
            .map(([month, period]) => ({ month: Number(month), period })),
        },
      });
      toast.success("Seasonal pricing saved.");
      void query.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Seasonal pricing could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">Seasonal pricing</h3>
            <p className="text-xs text-muted-foreground">
              Off by default. HIGH is the reference price; MID and LOW reduce it.
            </p>
          </div>
          <Switch checked={enabled} disabled={!canEdit} onCheckedChange={setEnabled} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">MID discount (%)</Label>
            <Input
              className="h-8 text-xs"
              value={discounts.MID}
              disabled={!canEdit}
              onChange={(e) => setDiscounts({ ...discounts, MID: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">LOW discount (%)</Label>
            <Input
              className="h-8 text-xs"
              value={discounts.LOW}
              disabled={!canEdit}
              onChange={(e) => setDiscounts({ ...discounts, LOW: e.target.value })}
            />
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium">Month of the year</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {MONTHS.map((m) => (
              <div key={m.value} className="flex items-center gap-2">
                <span className="w-20 text-xs">{m.label}</span>
                <select
                  className={selectClass}
                  value={months[m.value] ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const next = { ...months };
                    if (e.target.value === "") delete next[m.value];
                    else next[m.value] = e.target.value as SeasonPeriod;
                    setMonths(next);
                  }}
                >
                  <option value="">—</option>
                  {SEASON_PERIODS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {issues.length > 0 && (
          <ul className="space-y-1 text-xs">
            {issues.map((i, n) => (
              <li key={n} className={i.level === "error" ? "text-destructive" : "text-muted-foreground"}>
                • {i.message}
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <Button size="sm" variant="outline" disabled={busy} onClick={submit}>
            Save seasonal pricing
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
