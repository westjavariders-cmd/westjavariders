import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PublicPage } from "@/components/public/SiteHeader";
import { ProductIntroScreen } from "@/components/public/ProductIntroScreen";
import { getPublicProductIntro } from "@/lib/public.functions";

export const Route = createFileRoute("/build-your-trip/$productId/")({
  head: () => ({
    meta: [
      { title: "Your experience | Cimaja Boardriders" },
      {
        name: "description",
        content: "Read how this West Java experience works before you configure it.",
      },
      { property: "og:title", content: "Your experience — Cimaja Boardriders" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ProductIntroPage,
});

function ProductIntroPage() {
  const { productId } = Route.useParams();
  const load = useServerFn(getPublicProductIntro);
  const intro = useQuery({
    queryKey: ["public-product-intro", productId],
    queryFn: () => load({ data: { productId } }),
  });

  if (intro.isError) {
    return (
      <PublicPage>
        <p className="text-sm text-muted-foreground">
          {intro.error instanceof Error ? intro.error.message : "This experience is not available."}
        </p>
        <Link to="/build-your-trip" className="mt-4 inline-block text-sm underline">
          Back to all experiences
        </Link>
      </PublicPage>
    );
  }

  if (intro.isPending || !intro.data) {
    return (
      <PublicPage>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PublicPage>
    );
  }

  return <ProductIntroScreen intro={intro.data} />;
}
