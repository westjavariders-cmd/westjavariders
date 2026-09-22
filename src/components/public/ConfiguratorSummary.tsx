import { CurrencySelector } from "@/components/public/SiteHeader";
import { formatIdr, type AnswerSummaryLine } from "@/lib/public-catalog";
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

function QuoteTotal({
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
  const showIdrUnderCustomer = !quoting && !!quote && showCustomer;
  const showDiscount =
    !quoting && !!quote && (quote.season_discount_idr > 0 || quote.promo_discount_idr > 0);

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm text-muted-foreground">Total</span>
        <CurrencySelector />
      </div>
      <p aria-live="polite" aria-atomic="true" className="text-2xl font-semibold tracking-tight">
        {status}
      </p>
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

function QuoteNotes({ quote }: { quote: Quote | null }) {
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

function SelectionList({ lines }: { lines: AnswerSummaryLine[] }) {
  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">No selections yet</p>;
  }
  return (
    <dl className="space-y-3">
      {lines.map((line, i) => (
        <div key={`${line.label}-${i}`}>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {line.label}
          </dt>
          <dd
            className="mt-0.5 break-words text-sm font-medium leading-snug line-clamp-4"
            title={line.value}
          >
            {line.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SummaryBody({
  productTitle,
  imageUrl,
  lines,
  quote,
  display,
  quoting,
  unsaved,
  showCustomer,
  headingId,
}: {
  productTitle: string;
  imageUrl: string | null;
  lines: AnswerSummaryLine[];
  quote: Quote | null;
  display: QuoteDisplay | null;
  quoting: boolean;
  unsaved: boolean;
  showCustomer: boolean;
  headingId: string;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="size-12 shrink-0 rounded-md object-cover" />
        ) : null}
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-semibold tracking-tight">
            Your trip
          </h2>
          <p className="mt-1 text-sm font-medium leading-snug">{productTitle}</p>
        </div>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Your selections
        </h3>
        <div className="mt-3">
          <SelectionList lines={lines} />
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <QuoteTotal
          quote={quote}
          display={display}
          quoting={quoting}
          unsaved={unsaved}
          showCustomer={showCustomer}
        />
      </div>
      <QuoteNotes quote={quote} />
    </div>
  );
}

/**
 * Live trip summary + server quote. Presentation only: no pricing, no save.
 */
export function ConfiguratorSummary({
  productTitle,
  imageUrl,
  lines,
  quote,
  display,
  quoting,
  unsaved,
  showCustomer,
}: {
  productTitle: string;
  imageUrl: string | null;
  lines: AnswerSummaryLine[];
  quote: Quote | null;
  display: QuoteDisplay | null;
  quoting: boolean;
  unsaved: boolean;
  showCustomer: boolean;
}) {
  const compactPrice = priceStatusText(quoting, quote, unsaved, display, showCustomer);

  return (
    <div className="lg:col-start-2 lg:row-start-1">
      <details className="rounded-md border border-border lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          <span className="font-medium">Your trip</span>
          <span className="min-w-0 truncate text-right text-muted-foreground">
            {lines.length > 0 ? `${lines.length} selected` : "No selections yet"}
            <span className="mt-0.5 block font-medium text-foreground">{compactPrice}</span>
          </span>
        </summary>
        <div className="border-t border-border px-4 py-4">
          <SummaryBody
            productTitle={productTitle}
            imageUrl={imageUrl}
            lines={lines}
            quote={quote}
            display={display}
            quoting={quoting}
            unsaved={unsaved}
            showCustomer={showCustomer}
            headingId="configurator-summary-mobile"
          />
        </div>
      </details>

      <aside
        className="sticky top-20 hidden lg:block"
        aria-labelledby="configurator-summary-desktop"
      >
        <SummaryBody
          productTitle={productTitle}
          imageUrl={imageUrl}
          lines={lines}
          quote={quote}
          display={display}
          quoting={quoting}
          unsaved={unsaved}
          showCustomer={showCustomer}
          headingId="configurator-summary-desktop"
        />
      </aside>
    </div>
  );
}
