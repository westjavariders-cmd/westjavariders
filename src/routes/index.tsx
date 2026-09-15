import { createFileRoute } from "@tanstack/react-router";

import { HomeContent } from "@/components/public/HomeContent";
import { LandingScreen } from "@/components/public/LandingScreen";
import { PublicPage } from "@/components/public/SiteHeader";
import { getWebsiteLanding, getWebsitePage } from "@/lib/website.functions";

export const Route = createFileRoute("/")({
  loader: async () => {
    const { landing } = await getWebsiteLanding({ data: {} });
    if (landing) return { landing, page: null };
    const { page } = await getWebsitePage({ data: { slug: "home" } });
    return { landing: null, page };
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
      { title: "West Java Riders | Surf & Travel in West Java" },
      {
        name: "description",
        content:
          "West Java Riders — surf, travel and local experiences based in Cimaja, West Java, Indonesia.",
      },
      { property: "og:title", content: "West Java Riders" },
      {
        property: "og:description",
        content: "Surf, explore, experience West Java with West Java Riders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { landing, page } = Route.useLoaderData();

  if (landing) return <LandingScreen landing={landing} />;

  return (
    <PublicPage>
      <HomeContent page={page} />
    </PublicPage>
  );
}
