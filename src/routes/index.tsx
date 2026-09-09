import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicPage } from "@/components/public/SiteHeader";
import { WebsiteRenderer } from "@/components/public/WebsiteRenderer";
import { getWebsitePage } from "@/lib/website.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  loader: async () => {
    const { page } = await getWebsitePage({ data: { slug: "home" } });
    return { page };
  },
  errorComponent: ({ error }) => (
    <PublicPage>
      <p role="alert" className="py-8 text-sm text-muted-foreground">
        {error.message}
      </p>
    </PublicPage>
  ),
  notFoundComponent: () => (
    <PublicPage>
      <p className="py-8 text-sm text-muted-foreground">This page isn't available.</p>
    </PublicPage>
  ),
  head: () => ({
    meta: [
      { title: "Cimaja Boardriders | Surf & Travel in West Java" },
      {
        name: "description",
        content:
          "Cimaja Boardriders — surf, travel and local experiences based in Cimaja, West Java, Indonesia. The public site is in preparation.",
      },
      { property: "og:title", content: "Cimaja Boardriders" },
      {
        property: "og:description",
        content:
          "Surf, travel and local experiences based in Cimaja, West Java, Indonesia. The public site is in preparation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { page } = Route.useLoaderData();

  return (
    <PublicPage>
      <div className="py-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          {page?.title ?? "Surf, travel and local experiences in Cimaja"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {page?.subtitle ??
            "West Java's warm-water pointbreaks, local guides and trips built exactly the way you want them."}
        </p>

        {page && page.sections.length > 0 ? (
          <WebsiteRenderer page={page} showHeading={false} />
        ) : (
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/build-your-trip">Build your trip</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/cart">View your cart</Link>
            </Button>
          </div>
        )}

        <p className="mt-10 text-xs text-muted-foreground">
          <Link to="/admin" className="underline underline-offset-2">
            Staff sign in
          </Link>
        </p>
      </div>
    </PublicPage>
  );
}
