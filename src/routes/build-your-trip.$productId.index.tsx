import { createFileRoute, Link } from "@tanstack/react-router";

import { PackageLanding } from "@/components/public/PackageLanding";
import { PublicPage } from "@/components/public/SiteHeader";
import { getPublicProduct } from "@/lib/public.functions";

export const Route = createFileRoute("/build-your-trip/$productId/")({
  loader: async ({ params }) => {
    return getPublicProduct({ data: { productId: params.productId } });
  },
  head: ({ loaderData }) => {
    const title = loaderData?.product.title;
    return {
      meta: [
        { title: title ? `${title} | West Java Riders` : "Experience | West Java Riders" },
        { property: "og:type", content: "website" },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <PublicPage>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Link to="/build-your-trip" className="mt-4 inline-block text-sm underline">
        ← Back
      </Link>
    </PublicPage>
  ),
  component: PackageLandingPage,
});

function PackageLandingPage() {
  const data = Route.useLoaderData();
  const p = data.product;

  return (
    <PublicPage width="full">
      <PackageLanding
        productId={p.id}
        title={p.title}
        summary={p.summary}
        body={p.body}
        imageUrl={p.image_url}
      />
    </PublicPage>
  );
}
