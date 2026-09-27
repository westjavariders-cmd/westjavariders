import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { PublicPage } from "@/components/public/SiteHeader";
import { WebsiteRenderer } from "@/components/public/WebsiteRenderer";
import { getWebsitePage } from "@/lib/website.functions";

export const Route = createFileRoute("/pages/$slug")({
  loader: async ({ params }) => {
    const { page } = await getWebsitePage({ data: { slug: params.slug } });
    if (!page) throw notFound();
    return { page };
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
    const title = `${loaderData.page.title ?? "West Java Riders"} | West Java Riders`;
    const description =
      loaderData.page.subtitle ??
      "West Java Riders — surf, travel and local experiences in Cimaja, West Java, Indonesia.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
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
  component: WebsitePageRoute,
});

function WebsitePageRoute() {
  const { page } = Route.useLoaderData();
  return (
    <PublicPage width="full">
      <WebsiteRenderer page={page} />
    </PublicPage>
  );
}
