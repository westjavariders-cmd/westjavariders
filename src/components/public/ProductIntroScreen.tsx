import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SiteHeader, displayTotal, usePublicCart } from "@/components/public/SiteHeader";
import type { PublicProductIntro } from "@/lib/public-catalog.server";

export function ProductIntroScreen({ intro }: { intro: PublicProductIntro }) {
  const cart = usePublicCart();
  const fx = cart.data?.fx ?? null;
  const price = displayTotal(
    cart.data?.payable_total_idr ?? 0,
    fx,
    cart.data?.payable_total_customer,
  );
  const items = [
    intro.how_it_works_title
      ? {
          id: "how",
          title: intro.how_it_works_title,
          body: intro.how_it_works_body,
        }
      : null,
    intro.what_includes_title
      ? {
          id: "includes",
          title: intro.what_includes_title,
          body: intro.what_includes_body,
        }
      : null,
  ].filter((item): item is { id: string; title: string; body: string | null } => Boolean(item));

  return (
    <div className="public-theme min-h-svh bg-neutral-950 text-neutral-50">
      <SiteHeader />
      <main className="relative isolate min-h-[calc(100svh-4rem)] overflow-x-hidden">
        {intro.image_url ? (
          <img
            src={intro.image_url}
            alt={intro.title}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div aria-hidden="true" className="absolute inset-0 bg-neutral-900" />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/25"
        />

        <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-lg flex-col px-5 pb-36 pt-10 sm:px-8">
          <h1 className="text-balance text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {intro.title}
          </h1>

          {items.length > 0 && (
            <Accordion type="multiple" className="mt-8 space-y-3">
              {items.map((item) => (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className="overflow-hidden rounded-2xl border-0 bg-black/50"
                >
                  <AccordionTrigger className="px-4 py-3.5 text-left text-sm font-semibold text-neutral-50 hover:no-underline [&>svg]:text-neutral-50">
                    <span className="min-w-0">
                      <span className="block">{item.title}</span>
                      {item.body && (
                        <span className="mt-0.5 block truncate text-xs font-normal text-neutral-50/70">
                          {item.body}
                        </span>
                      )}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 text-sm leading-relaxed text-neutral-50/85">
                    {item.body}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto flex w-full max-w-lg items-center gap-3">
            <Link
              to="/cart"
              className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl bg-black/70 px-4 py-2 text-neutral-50"
            >
              <span className="min-w-0">
                <span className="block text-[11px] text-neutral-50/70">Your price</span>
                <span className="block truncate text-sm font-semibold">{price}</span>
              </span>
              <ShoppingBag className="ml-auto size-5 shrink-0" strokeWidth={1.75} />
            </Link>
            {intro.start_cta_label && (
              <Link
                to="/build-your-trip/$productId/configure"
                params={{ productId: intro.id }}
                className="inline-flex min-h-14 shrink-0 items-center justify-center rounded-2xl bg-[#FF7F50] px-5 text-sm font-semibold text-neutral-950"
              >
                {intro.start_cta_label}
                <span aria-hidden="true" className="ml-2">
                  →
                </span>
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
