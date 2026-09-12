import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  PEOPLE_OPTIONS,
  TRAVEL_HOUR_OPTIONS,
  formatIdr,
  otherLocationQuote,
  otherLocationQuoteMultiplied,
  parseIdr,
  transportMargin,
  type TransportType,
} from "@/lib/transport";
import { savePeoplePrices, saveTimePrices } from "@/lib/transport.functions";
import { selectClass } from "@/components/admin/configurator/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

type Row = { supplier: string; customer: string };
type RowMap = Record<number, Row>;

const emptyRow: Row = { supplier: "0", customer: "0" };

function toRowMap(
  keys: readonly number[],
  rows: { key: number; supplier_cost_idr: number; customer_price_idr: number }[],
): RowMap {
  const map: RowMap = {};
  for (const key of keys) {
    const found = rows.find((r) => r.key === key);
    map[key] = found
      ? { supplier: String(found.supplier_cost_idr), customer: String(found.customer_price_idr) }
      : { ...emptyRow };
  }
  return map;
}

export function TransportPricing({
  transportId,
  transportType,
  canEdit,
}: {
  transportId: string;
  transportType: TransportType;
  canEdit: boolean;
}) {
  const savePeople = useServerFn(savePeoplePrices);
  const saveTime = useServerFn(saveTimePrices);

  const [people, setPeople] = useState<RowMap | null>(null);
  const [time, setTime] = useState<RowMap | null>(null);
  const [busy, setBusy] = useState(false);
  const [calcHours, setCalcHours] = useState(1);
  const [calcPeople, setCalcPeople] = useState(1);
  const [calcMode, setCalcMode] = useState<"sum" | "multiply">("sum");

  const prices = useQuery({
    queryKey: ["transport-prices", transportId],
    queryFn: async () => {
      const [peopleRes, timeRes] = await Promise.all([
        supabase
          .from("transport_people_prices")
          .select("people, supplier_cost_idr, customer_price_idr")
          .eq("transport_id", transportId)
          .order("people"),
        supabase
          .from("transport_time_prices")
          .select("travel_hours, supplier_cost_idr, customer_price_idr")
          .eq("transport_id", transportId)
          .order("travel_hours"),
      ]);
      if (peopleRes.error) throw new Error(peopleRes.error.message);
      if (timeRes.error) throw new Error(timeRes.error.message);
      return { people: peopleRes.data, time: timeRes.data };
    },
  });

  useEffect(() => {
    if (!prices.data || people) return;
    setPeople(
      toRowMap(
        PEOPLE_OPTIONS,
        prices.data.people.map((r) => ({ key: r.people, ...r })),
      ),
    );
    setTime(
      toRowMap(
        TRAVEL_HOUR_OPTIONS,
        prices.data.time.map((r) => ({ key: r.travel_hours, ...r })),
      ),
    );
  }, [prices.data, people]);

  if (prices.isLoading || !people || !time) {
    return <p className="text-sm text-muted-foreground">Loading prices...</p>;
  }

  const parsedPeople = PEOPLE_OPTIONS.map((n) => ({
    people: n,
    supplier_cost_idr: parseIdr(people[n]!.supplier),
    customer_price_idr: parseIdr(people[n]!.customer),
  }));
  const parsedTime = TRAVEL_HOUR_OPTIONS.map((h) => ({
    travel_hours: h,
    supplier_cost_idr: parseIdr(time[h]!.supplier),
    customer_price_idr: parseIdr(time[h]!.customer),
  }));

  async function save() {
    if (
      parsedPeople.some((r) => r.supplier_cost_idr == null || r.customer_price_idr == null) ||
      parsedTime.some((r) => r.supplier_cost_idr == null || r.customer_price_idr == null)
    ) {
      toast.error("Amounts must be whole Rupiah, with no decimals.");
      return;
    }
    setBusy(true);
    try {
      await savePeople({
        data: {
          transport_id: transportId,
          rows: parsedPeople.map((r) => ({
            people: r.people,
            supplier_cost_idr: r.supplier_cost_idr!,
            customer_price_idr: r.customer_price_idr!,
          })),
        },
      });
      if (transportType === "other_location") {
        await saveTime({
          data: {
            transport_id: transportId,
            rows: parsedTime.map((r) => ({
              travel_hours: r.travel_hours,
              supplier_cost_idr: r.supplier_cost_idr!,
              customer_price_idr: r.customer_price_idr!,
            })),
          },
        });
      }
      toast.success("Prices saved.");
      void prices.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "These prices could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const quote = otherLocationQuote({
    timePrice: {
      supplier_cost_idr: parseIdr(time[calcHours]!.supplier) ?? 0,
      customer_price_idr: parseIdr(time[calcHours]!.customer) ?? 0,
    },
    peoplePrice: {
      supplier_cost_idr: parseIdr(people[calcPeople]!.supplier) ?? 0,
      customer_price_idr: parseIdr(people[calcPeople]!.customer) ?? 0,
    },
  });

  const multipliedQuote = otherLocationQuoteMultiplied({
    timePrice: {
      supplier_cost_idr: parseIdr(time[calcHours]!.supplier) ?? 0,
      customer_price_idr: parseIdr(time[calcHours]!.customer) ?? 0,
    },
    people: calcPeople,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div>
            <h3 className="text-sm font-medium">Price per number of people</h3>
            <p className="text-xs text-muted-foreground">
              Supplier cost and customer price are independent values. Zero is allowed. Margin is shown for
              information only.
            </p>
          </div>
          <div className="space-y-2">
            {PEOPLE_OPTIONS.map((n) => {
              const supplier = parseIdr(people[n]!.supplier);
              const customer = parseIdr(people[n]!.customer);
              const margin =
                supplier == null || customer == null ? null : transportMargin(supplier, customer);
              return (
                <div key={n} className="flex flex-wrap items-end gap-2 rounded-md border p-2">
                  <p className="w-20 text-xs font-medium">{n} {n === 1 ? "person" : "people"}</p>
                  <div>
                    <Label className="text-xs">Supplier cost (IDR)</Label>
                    <Input
                      className="h-8 w-32 text-xs"
                      disabled={!canEdit}
                      value={people[n]!.supplier}
                      onChange={(e) => setPeople({ ...people, [n]: { ...people[n]!, supplier: e.target.value } })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Customer price (IDR)</Label>
                    <Input
                      className="h-8 w-32 text-xs"
                      disabled={!canEdit}
                      value={people[n]!.customer}
                      onChange={(e) => setPeople({ ...people, [n]: { ...people[n]!, customer: e.target.value } })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {margin
                      ? `Margin ${formatIdr(margin.amount)} (${margin.percentage.toFixed(1)}%)`
                      : "Whole Rupiah only"}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {transportType === "other_location" && (
        <>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div>
                <h3 className="text-sm font-medium">Price per travel time</h3>
                <p className="text-xs text-muted-foreground">
                  Travel time from 1 to 9 hours. The customer price for other locations is the time price plus
                  the people price.
                </p>
              </div>
              <div className="space-y-2">
                {TRAVEL_HOUR_OPTIONS.map((h) => {
                  const supplier = parseIdr(time[h]!.supplier);
                  const customer = parseIdr(time[h]!.customer);
                  const margin =
                    supplier == null || customer == null ? null : transportMargin(supplier, customer);
                  return (
                    <div key={h} className="flex flex-wrap items-end gap-2 rounded-md border p-2">
                      <p className="w-20 text-xs font-medium">{h} {h === 1 ? "hour" : "hours"}</p>
                      <div>
                        <Label className="text-xs">Supplier cost (IDR)</Label>
                        <Input
                          className="h-8 w-32 text-xs"
                          disabled={!canEdit}
                          value={time[h]!.supplier}
                          onChange={(e) => setTime({ ...time, [h]: { ...time[h]!, supplier: e.target.value } })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Customer price (IDR)</Label>
                        <Input
                          className="h-8 w-32 text-xs"
                          disabled={!canEdit}
                          value={time[h]!.customer}
                          onChange={(e) => setTime({ ...time, [h]: { ...time[h]!, customer: e.target.value } })}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {margin
                          ? `Margin ${formatIdr(margin.amount)} (${margin.percentage.toFixed(1)}%)`
                          : "Whole Rupiah only"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <div>
                <h3 className="text-sm font-medium">Internal calculator</h3>
                <p className="text-xs text-muted-foreground">
                  Admin reference only. It is not connected to product pricing.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <Label className="text-xs">Travel hours</Label>
                  <select
                    className={selectClass}
                    value={calcHours}
                    onChange={(e) => setCalcHours(Number(e.target.value))}
                  >
                    {TRAVEL_HOUR_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">People</Label>
                  <select
                    className={selectClass}
                    value={calcPeople}
                    onChange={(e) => setCalcPeople(Number(e.target.value))}
                  >
                    {PEOPLE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                </div>
                <div>
                  <Label className="text-xs">Calculation</Label>
                  <select
                    className={selectClass}
                    value={calcMode}
                    onChange={(e) => setCalcMode(e.target.value as "sum" | "multiply")}
                  >
                    <option value="sum">Time price + people price</option>
                    <option value="multiply">Time price x number of people</option>
                  </select>
                </div>
              </div>
              {calcMode === "multiply" && multipliedQuote && (
                <dl className="grid gap-1 text-xs sm:grid-cols-2">
                  <div className="flex justify-between gap-4 sm:col-span-2">
                    <dt>Time price</dt>
                    <dd>{formatIdr(multipliedQuote.timeCustomerIdr)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:col-span-2">
                    <dt>People</dt>
                    <dd>x {multipliedQuote.people}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t pt-1 font-medium sm:col-span-2">
                    <dt>Final price</dt>
                    <dd>{formatIdr(multipliedQuote.finalPriceIdr)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:col-span-2">
                    <dt>Internal cost</dt>
                    <dd>{formatIdr(multipliedQuote.internalCostIdr)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:col-span-2">
                    <dt>Margin</dt>
                    <dd>
                      {formatIdr(multipliedQuote.amount)} ({multipliedQuote.percentage.toFixed(1)}%)
                    </dd>
                  </div>
                </dl>
              )}
              {calcMode === "sum" && quote && (
                <dl className="grid gap-1 text-xs sm:grid-cols-2">
                  <div className="flex justify-between gap-4 sm:col-span-2">
                    <dt>Time price</dt>
                    <dd>{formatIdr(quote.timeCustomerIdr)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:col-span-2">
                    <dt>People price</dt>
                    <dd>{formatIdr(quote.peopleCustomerIdr)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t pt-1 font-medium sm:col-span-2">
                    <dt>Final price</dt>
                    <dd>{formatIdr(quote.finalPriceIdr)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:col-span-2">
                    <dt>Internal cost</dt>
                    <dd>{formatIdr(quote.internalCostIdr)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:col-span-2">
                    <dt>Margin</dt>
                    <dd>
                      {formatIdr(quote.amount)} ({quote.percentage.toFixed(1)}%)
                    </dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {canEdit && (
        <Button size="sm" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving..." : "Save prices"}
        </Button>
      )}
    </div>
  );
}
