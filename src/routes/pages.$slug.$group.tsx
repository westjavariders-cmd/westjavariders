import { Outlet, createFileRoute, Link, notFound } from "@tanstack/react-router";

import { PublicPage } from "@/components/public/SiteHeader";
import { getWebsitePage } from "@/lib/website.functions";
import { assignGroupKeys } from "@/lib/website";

export const Route = createFileRoute("/pages/$slug/$group")({
  loader: async ({ params }) => {
    const { page } = await getWebsitePage({ data: { slug: params.slug } });
    if (!page) throw notFound();
    const keys = assignGroupKeys(page.sections);
    const section = page.sections.find((entry) => keys.get(entry.id) === params.group);
    if (!section) throw notFound();
    return { page, group: params.group, sectionTitle: section.title };
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
    const heading = loaderData.sectionTitle ?? loaderData.page.title ?? "West Java Riders";
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
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been switched off.{" "}
          <Link to="/" className="underline underline-offset-2">
            Go back home
          </Link>
          .
        </p>
      </div>
    </PublicPage>
  ),
  component: CatalogueGroupLayout,
});

function CatalogueGroupLayout() {
  return <Outlet />;
}
