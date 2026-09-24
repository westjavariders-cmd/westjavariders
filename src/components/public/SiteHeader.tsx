import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";

import { getPublicCart } from "@/lib/public.functions";
import { getWebsiteNav } from "@/lib/website.functions";
import { setFxCurrency } from "@/lib/fx.functions";
import { formatIdr } from "@/lib/public-catalog";
import { formatCustomerAmount } from "@/lib/fx";
import { cn } from "@/lib/utils";

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
        className="h-9 rounded-none border-0 bg-transparent px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
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

const DESKTOP_NAV = "(min-width: 1280px)";

type CmsNavItem = {
  id: string;
  label: string;
  href: string;
  external: boolean;
  image_url: string | null;
};

function CmsNavLinks({
  items,
  variant,
  onNavigate,
}: {
  items: CmsNavItem[];
  variant: "desktop" | "mobile";
  onNavigate?: () => void;
}) {
  if (items.length === 0) {
    return (
      <Link
        to="/build-your-trip"
        className={
          variant === "desktop"
            ? "text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
            : "block min-h-12 py-3 text-2xl font-medium tracking-tight"
        }
        activeProps={{ className: "text-foreground" }}
        onClick={onNavigate}
      >
        Build your trip
      </Link>
    );
  }

  return items.map((item) => {
    const withImage = Boolean(item.image_url);
    const className =
      variant === "desktop"
        ? withImage
          ? "group relative flex h-[4.25rem] w-[8.25rem] shrink-0 items-end overflow-hidden px-2.5 py-2"
          : "whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
        : withImage
          ? "group relative mb-3 flex h-32 shrink-0 items-end overflow-hidden px-4 py-3"
          : "block min-h-12 py-3 text-2xl font-medium tracking-tight text-foreground";

    return (
      <a
        key={item.id}
        href={item.href}
        {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={className}
        onClick={onNavigate}
      >
        {withImage ? (
          <>
            <img
              src={item.image_url ?? undefined}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-black/50 transition-colors duration-300 group-hover:bg-black/40"
            />
            <span
              className={
                variant === "desktop"
                  ? "relative z-10 text-[10px] font-medium uppercase leading-tight tracking-[0.16em] text-white"
                  : "relative z-10 text-xl font-medium tracking-tight text-white"
              }
            >
              {item.label}
            </span>
          </>
        ) : (
          item.label
        )}
      </a>
    );
  });
}

export function SiteHeader() {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const cart = usePublicCart();
  const nav = useWebsiteNav();
  const navItems = nav.data?.items ?? [];
  const hasNavImages = navItems.some((item) => Boolean(item.image_url));
  const total = displayTotal(
    cart.data?.payable_total_idr ?? 0,
    cart.data?.fx,
    cart.data?.payable_total_customer,
  );

  const openButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_NAV);
    const collapse = () => {
      if (media.matches) setOpen(false);
    };
    media.addEventListener("change", collapse);
    return () => media.removeEventListener("change", collapse);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [
        ...panelRef.current.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), select:not([disabled]), textarea, input",
        ),
      ];
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const trigger = openButtonRef.current;
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/90 backdrop-blur-md">
      <div
        className={cn(
          "mx-auto grid max-w-[90rem] grid-cols-[auto_1fr_auto] items-center gap-3 px-4 sm:px-6 lg:px-10 xl:grid-cols-[1fr_auto_1fr]",
          hasNavImages ? "h-16 sm:h-[4.25rem] xl:h-[5.75rem]" : "h-16 sm:h-[4.25rem]",
        )}
      >
        <div className="flex items-center xl:justify-start">
          <button
            ref={openButtonRef}
            type="button"
            className="inline-flex min-h-11 max-w-[8.5rem] items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-left text-[10px] font-medium uppercase leading-tight tracking-[0.12em] transition-colors hover:bg-muted sm:max-w-[16rem] md:max-w-[18rem] sm:text-[11px] sm:tracking-[0.14em] xl:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-4 shrink-0" strokeWidth={1.5} /> : null}
            <span className="truncate">Surf, Explore, Experience West Java</span>
          </button>
          <Link
            to="/home"
            className="hidden text-[13px] font-semibold uppercase tracking-[0.22em] xl:inline"
          >
            West Java Riders
          </Link>
        </div>

        <Link
          to="/home"
          className="justify-self-center whitespace-nowrap text-center text-[12px] font-semibold uppercase tracking-[0.22em] xl:hidden"
        >
          West Java Riders
        </Link>

        <nav
          className={cn(
            "hidden items-center justify-center xl:flex",
            hasNavImages ? "gap-x-2.5" : "gap-x-7",
          )}
          aria-label="Primary"
        >
          <CmsNavLinks items={navItems} variant="desktop" />
        </nav>

        <div className="flex items-center justify-end gap-3 sm:gap-4">
          <CurrencySelector />
          <Link
            to="/cart"
            className="inline-flex min-h-11 items-center whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.18em]"
          >
            <span className="sr-only">Cart </span>
            <span className="hidden sm:inline">TOTAL PRICE — </span>
            {total}
          </Link>
        </div>
      </div>

      {open &&
        createPortal(
          <div className="public-theme xl:hidden">
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              className="cbr-nav-overlay fixed inset-0 z-50 bg-black/55"
              onClick={() => setOpen(false)}
            />
            <div
              ref={panelRef}
              id={menuId}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="cbr-nav-drawer fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-background px-6 pb-8 pt-5 text-foreground sm:px-8"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  West Java Riders
                </p>
                <button
                  ref={closeButtonRef}
                  type="button"
                  className="inline-flex h-11 min-w-11 items-center justify-center"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                >
                  <X className="size-5" strokeWidth={1.5} />
                </button>
              </div>

              <nav className="mt-10 flex flex-1 flex-col overflow-y-auto" aria-label="Primary">
                <CmsNavLinks items={navItems} variant="mobile" onNavigate={() => setOpen(false)} />
              </nav>

              <Link
                to="/cart"
                className="mt-8 flex min-h-12 items-center justify-between border-t border-border/40 pt-5 text-[11px] font-medium uppercase tracking-[0.18em]"
                onClick={() => setOpen(false)}
              >
                <span>Cart</span>
                <span>{total}</span>
              </Link>
            </div>
          </div>,
          document.body,
        )}
    </header>
  );
}

export type PublicPageWidth = "readable" | "wide" | "full";

/** Horizontal padding for the public shell. Width is chosen per page. */
export function PublicPage({
  children,
  width = "readable",
}: {
  children: React.ReactNode;
  width?: PublicPageWidth;
}) {
  return (
    <div className="public-theme min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main
        className={cn(
          "px-4 pb-20 pt-8 md:px-8 md:pt-10 lg:px-10 lg:pt-12 xl:px-12",
          width === "readable" && "mx-auto w-full max-w-3xl",
          width === "wide" && "mx-auto w-full max-w-6xl",
          width === "full" && "w-full",
        )}
      >
        {children}
      </main>
    </div>
  );
}
