import { createFileRoute } from "@tanstack/react-router";

import { PublicPage } from "@/components/public/SiteHeader";
import { WebsiteRenderer } from "@/components/public/WebsiteRenderer";
import { getWebsitePage } from "@/lib/website.functions";
import { SURF_LEVEL_PAGE_SLUG } from "@/lib/website";
import type { PublicWebsitePage } from "@/lib/website.server";

export const Route = createFileRoute("/choose-your-level")({
  loader: async () => {
    try {
      const { page } = await getWebsitePage({ data: { slug: SURF_LEVEL_PAGE_SLUG } });
      return { page };
    } catch {
      return { page: null };
    }
  },
  head: () => ({
    meta: [
      { title: "What's your surf level? | West Java Riders" },
      {
        name: "description",
        content: "Choose Beginner and Low Intermediate or Intermediate + Pro to open the right trip.",
      },
    ],
  }),
  errorComponent: ({ error }) => (
    <PublicPage>
      <p role="alert" className="py-8 text-sm text-muted-foreground">
        {error.message}
      </p>
    </PublicPage>
  ),
  component: SurfLevelRoute,
});

function fallbackPage(): PublicWebsitePage {
  return {
    slug: SURF_LEVEL_PAGE_SLUG,
    title: "What's your surf level?",
    subtitle: null,
    language: "en",
    sections: [
      {
        id: "level",
        title: null,
        subtitle: null,
        blocks: [
          {
            id: "beginner",
            kind: "door",
            title: "Beginner and Low Intermediate",
            body: null,
            media: null,
            cta: null,
            products: [],
            catalogue_items: [],
          },
          {
            id: "intermediate",
            kind: "door",
            title: "Intermediate + Pro",
            body: null,
            media: null,
            cta: null,
            products: [],
            catalogue_items: [],
          },
        ],
      },
    ],
  };
}

function SurfLevelRoute() {
  const { page } = Route.useLoaderData();
  const hasDoors = Boolean(page?.sections.some((section) => section.blocks.some((block) => block.kind === "door")));
  return (
    <PublicPage width="full">
      <WebsiteRenderer page={hasDoors && page ? page : fallbackPage()} />
    </PublicPage>
  );
}
