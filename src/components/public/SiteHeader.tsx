import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Menu, X } from "lucide-react";

import { getPublicCart } from "@/lib/public.functions";
import { getWebsiteNav } from "@/lib/website.functions";
import { setFxCurrency } from "@/lib/fx.functions";
import { formatIdr } from "@/lib/public-catalog";
import { formatCustomerAmount } from "@/lib/fx";
import { Button } from "@/components/ui/button";

/** One display rule for every customer-facing total. */
export function displayTotal(
  amountIdr: number,
  fx?: { currency_code: string; symbol: string } | null,
  customerAmount?: number | null,
): string {
  if (!fx || fx.currency_code === "IDR" || customerAmount == null) return formatIdr(amountIdr);
  return formatCustomerAmount(customerAmount, fx.currency_code, fx.symbol);
}

export const PUBLIC_CART_KEY = ["public-cart"] as const;

/** Mini cart: only the server-authoritative payable total, never cart details. */
export function usePublicCart() {
  const fetchCart = useServerFn(getPublicCart);
  return useQuery({ queryKey: PUBLIC_CART_KEY, queryFn: () => fetchCart() });
}

/** Currency selector. The server decides what is supported and at what rate. */
export function CurrencySelector() {
  const cart = usePublicCart();
  const queryClient = useQueryClient();
  const select = useServerFn(setFxCurrency);
  const change = useMutation({
    mutationFn: (code: string) => select({ data: { code } }),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const fx = cart.data?.fx;
  if (!fx || fx.currencies.length < 2) return null;

  return (
    <label>
      <span className="sr-only">Currency</span>
      <select
        aria-label="Currency"
        className="rounded-full border border-border bg-background px-2 py-1.5 text-xs font-medium"
        value={fx.currency_code}
        disabled={change.isPending}
        onChange={(e) => change.mutate(e.target.value)}
      >
        {fx.currencies.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The configured menu, when Admin has set one up. */
function useWebsiteNav() {
  const load = useServerFn(getWebsiteNav);
  return useQuery({ queryKey: ["website-nav"], queryFn: () => load({ data: {} }) });
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const cart = usePublicCart();
  const nav = useWebsiteNav();
  const navItems = nav.data?.items ?? [];
  const total = displayTotal(
    cart.data?.payable_total_idr ?? 0,
    cart.data?.fx,
    cart.data?.payable_total_customer,
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={open ? "Close menu" : "Open menu"}
            className="gap-1.5 px-2 sm:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
            MENU
          </Button>
          <Link to="/home" className="text-sm font-semibold uppercase tracking-[0.18em]">
            Cimaja Boardriders
          </Link>
        </div>

        <nav className="hidden items-center gap-5 text-sm sm:flex">
          {navItems.length > 0 ? (
            navItems.map((item) => (
              <a
                key={item.id}
                href={item.href}
                {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </a>
            ))
          ) : (
            <Link to="/build-your-trip" activeProps={{ className: "font-semibold" }}>
              Build your trip
            </Link>
          )}
          <Link to="/cart" className="text-muted-foreground hover:text-foreground">
            Cart
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <CurrencySelector />
          <Link
            to="/cart"
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium tracking-wide"
          >
            <span className="hidden sm:inline">TOTAL PRICE — </span>
            {total}
          </Link>
        </div>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-border/60 px-4 py-2 text-sm sm:hidden">
          {navItems.length > 0 ? (
            navItems.map((item) => (
              <a
                key={item.id}
                href={item.href}
                {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="py-2"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ))
          ) : (
            <Link to="/build-your-trip" className="py-2" onClick={() => setOpen(false)}>
              Build your trip
            </Link>
          )}
          <Link to="/cart" className="py-2" onClick={() => setOpen(false)}>
            Cart
          </Link>
        </nav>
      )}
    </header>
  );
}

export function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-theme min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">{children}</main>
    </div>
  );
}
