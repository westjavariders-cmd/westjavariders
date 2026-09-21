import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PublicPage } from "@/components/public/SiteHeader";
import { WebsiteRenderer } from "@/components/public/WebsiteRenderer";
import { listPublicProducts } from "@/lib/public.functions";
import { getWebsitePage } from "@/lib/website.functions";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/build-your-trip/")({
  head: () => ({
    meta: [
      { title: "Build Your Trip | Cimaja Boardriders" },
      {
        name: "description",
        content:
          "Choose a surf, travel or local experience in Cimaja, West Java, configure it your way and see your price instantly.",
      },
      { property: "og:title", content: "Build Your Trip — Cimaja Boardriders" },
      {
        property: "og:description",
        content:
          "Configure your surf trip, lessons or local experience in Cimaja, West Java and see your price instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BuildYourTrip,
});

function BuildYourTrip() {
  const load = useServerFn(listPublicProducts);
  const loadPage = useServerFn(getWebsitePage);
  const products = useQuery({ queryKey: ["public-products"], queryFn: () => load() });
  const configured = useQuery({
    queryKey: ["website-page", "build-your-trip"],
    queryFn: () => loadPage({ data: { slug: "build-your-trip" } }),
  });

  const page = configured.data?.page ?? null;
  const hasConfigured = Boolean(page && page.sections.length > 0);

  return (
    <PublicPage width="full">
      <h1 className="mx-auto max-w-3xl text-2xl font-semibold tracking-tight">
        {page?.title ?? "Build your trip"}
      </h1>
      <p className="mx-auto mt-2 max-w-3xl text-sm text-muted-foreground">
        {page?.subtitle ??
          "Pick an experience, choose your options and see your price straight away."}
      </p>

      {hasConfigured && page && <WebsiteRenderer page={page} showHeading={false} />}

      {!hasConfigured && (
        <div className="mx-auto mt-6 max-w-3xl space-y-3">
          {(products.isPending || configured.isPending) && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {products.data?.products.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing is open for booking right now. Please check back soon.
            </p>
          )}
          {products.data?.products.map((p) => (
            <Link
              key={p.id}
              to="/build-your-trip/$productId"
              params={{ productId: p.id }}
              className="block"
            >
              <Card className="transition-colors hover:border-primary">
                <CardContent className="p-4">
                  {p.categories.length > 0 && (
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {p.categories.join(" · ")}
                    </p>
                  )}
                  <h2 className="mt-1 text-base font-medium">{p.title}</h2>
                  {p.summary && <p className="mt-1 text-sm text-muted-foreground">{p.summary}</p>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PublicPage>
  );
}
