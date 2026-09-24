import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { PublicPage } from "@/components/public/SiteHeader";
import { WebsiteRenderer } from "@/components/public/WebsiteRenderer";
import { getWebsitePage } from "@/lib/website.functions";
import { assignGroupKeys } from "@/lib/website";

export const Route = createFileRoute("/pages/$slug/$group/$catalogue")({
  loader: async ({ params }) => {
    const { page } = await getWebsitePage({ data: { slug: params.slug } });
    if (!page) throw notFound();
    const groupKeys = assignGroupKeys(page.sections);
    const section = page.sections.find((entry) => groupKeys.get(entry.id) === params.group);
    if (!section) throw notFound();
    const catalogues = section.blocks.filter((block) => block.kind === "catalogue");
    const catalogueKeys = assignGroupKeys(
      catalogues.map((block) => ({
        id: block.id,
        title: block.title?.trim() || block.catalogue_items[0]?.catalogue_name || null,
      })),
    );
    const catalogue = catalogues.find((block) => catalogueKeys.get(block.id) === params.catalogue);
    if (!catalogue) throw notFound();
    return {
      page,
      group: params.group,
      catalogue: params.catalogue,
      heading: catalogue.title?.trim() || catalogue.catalogue_items[0]?.catalogue_name || section.title,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Page unavailable | West Java Riders" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const heading = loaderData.heading ?? loaderData.page.title ?? "West Java Riders";
    const title = `${heading} | West Java Riders`;
    return {
      meta: [
        { title },
        { property: "og:title", content: title },
        { property: "og:type", content: "website" },
      ],
    };
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
      <div className="py-10">
        <h1 className="text-xl font-semibold tracking-tight">This page isn't available</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          It may have been switched off.{" "}
          <Link to="/" className="underline underline-offset-2">
            Go back home
          </Link>
          .
        </p>
      </div>
    </PublicPage>
  ),
  component: CatalogueDetailRoute,
});

function CatalogueDetailRoute() {
  const { page, group, catalogue } = Route.useLoaderData();
  return (
    <PublicPage width="full">
      <WebsiteRenderer page={page} showHeading={false} groupKey={group} catalogueKey={catalogue} />
    </PublicPage>
  );
}
