import { createFileRoute } from "@tanstack/react-router";

import { HomeContent } from "@/components/public/HomeContent";
import { PublicPage } from "@/components/public/SiteHeader";
import { getWebsitePage } from "@/lib/website.functions";

export const Route = createFileRoute("/home")({
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
      { title: "West Java Riders | Surf trips & experiences in West Java" },
      {
        name: "description",
        content:
          "Plan surf trips, transfers, stays and local experiences in Cimaja, West Java, with the West Java Riders team.",
      },
      { property: "og:title", content: "West Java Riders — Surf & travel in West Java" },
      {
        property: "og:description",
        content:
          "Plan surf trips, transfers, stays and local experiences in Cimaja, West Java, with the West Java Riders team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomeRoute,
});

function HomeRoute() {
  const { page } = Route.useLoaderData();
  return (
    <PublicPage width="full">
      <HomeContent page={page} />
    </PublicPage>
  );
}
