import { formatIdr } from "@/lib/public-catalog";
import { formatCustomerAmount } from "@/lib/fx";

type Quote = {
  configuration_issues: string[];
  errors: string[];
  promo_rejection: string | null;
  subtotal_idr: number;
  season_discount_idr: number;
  promo_discount_idr: number;
  total_idr: number;
};

type QuoteDisplay = {
  fx: { currency_code: string; symbol: string } | null;
  total_customer: number | null;
};

function quoteAmount(
  quote: Quote | null,
  display: QuoteDisplay | null,
  showCustomer: boolean,
): string {
  if (!quote) return "—";
  if (showCustomer && display?.fx && display.total_customer != null) {
    return formatCustomerAmount(
      display.total_customer,
      display.fx.currency_code,
      display.fx.symbol,
    );
  }
  return formatIdr(quote.total_idr);
}

/** Visible price copy from existing quote/quoting/unsaved flags. No client math. */
function priceStatusText(
  quoting: boolean,
  quote: Quote | null,
  unsaved: boolean,
  display: QuoteDisplay | null,
  showCustomer: boolean,
): string {
  if (quoting) return "Updating price…";
  if (!quote) return unsaved ? "Price unavailable." : "—";
  return quoteAmount(quote, display, showCustomer);
}

/** Server quote on the Add to cart card. Presentation only. */
export function QuoteTotal({
  quote,
  display,
  quoting,
  unsaved,
  showCustomer,
}: {
  quote: Quote | null;
  display: QuoteDisplay | null;
  quoting: boolean;
  unsaved: boolean;
  showCustomer: boolean;
}) {
  const status = priceStatusText(quoting, quote, unsaved, display, showCustomer);
  const amount = quote ? quoteAmount(quote, display, showCustomer) : null;
  const showIdrUnderCustomer = !!quote && showCustomer;
  const showDiscount =
    !!quote && (quote.season_discount_idr > 0 || quote.promo_discount_idr > 0);

  return (
    <div className="space-y-1">
      <p className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {amount ?? (quoting ? "—" : status)}
      </p>
      {quoting ? (
        <p aria-live="polite" aria-atomic="true" className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          {status}
        </p>
      ) : (
        <p aria-live="polite" aria-atomic="true" className="sr-only">
          {status}
        </p>
      )}
      {showIdrUnderCustomer ? (
        <p className="text-xs text-muted-foreground">{formatIdr(quote!.total_idr)}</p>
      ) : null}
      {showDiscount ? (
        <p className="text-xs text-muted-foreground">
          Before discount {formatIdr(quote!.subtotal_idr)} · saving{" "}
          {formatIdr(quote.season_discount_idr + quote.promo_discount_idr)}
        </p>
      ) : null}
    </div>
  );
}

export function QuoteNotes({ quote }: { quote: Quote | null }) {
  if (!quote) return null;
  return (
    <div className="space-y-2">
      {quote.promo_rejection ? (
        <p className="text-xs text-destructive">{quote.promo_rejection}</p>
      ) : null}
      {quote.configuration_issues.length > 0 ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {quote.configuration_issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
      {quote.errors.length > 0 ? (
        <ul className="space-y-1 text-xs text-destructive">
          {quote.errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
