import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Menu, X } from "lucide-react";

import { getPublicCart } from "@/lib/public.functions";
import { formatIdr } from "@/lib/public-catalog";

export const PUBLIC_CART_KEY = ["public-cart"] as const;

/** Mini cart: only the server-authoritative payable total, never cart details. */
export function usePublicCart() {
  const fetchCart = useServerFn(getPublicCart);
  return useQuery({ queryKey: PUBLIC_CART_KEY, queryFn: () => fetchCart() });
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const cart = usePublicCart();
  const total = formatIdr(cart.data?.payable_total_idr ?? 0);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent sm:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
            MENU
          </button>
          <Link to="/" className="text-sm font-semibold uppercase tracking-[0.18em]">
            Cimaja Boardriders
          </Link>
        </div>

        <nav className="hidden items-center gap-5 text-sm sm:flex">
          <Link to="/build-your-trip" activeProps={{ className: "font-semibold" }}>
            Build your trip
          </Link>
          <Link to="/cart" className="text-muted-foreground hover:text-foreground">
            Cart
          </Link>
        </nav>

        <Link
          to="/cart"
          className="rounded-full border border-border px-3 py-1.5 text-xs font-medium tracking-wide"
        >
          <span className="hidden sm:inline">TOTAL PRICE — </span>
          {total}
        </Link>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-border/60 px-4 py-2 text-sm sm:hidden">
          <Link to="/build-your-trip" className="py-2" onClick={() => setOpen(false)}>
            Build your trip
          </Link>
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
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">{children}</main>
    </div>
  );
}
