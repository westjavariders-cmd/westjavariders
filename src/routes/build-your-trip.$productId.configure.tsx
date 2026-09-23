import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { PublicPage, PUBLIC_CART_KEY } from "@/components/public/SiteHeader";
import { ConfiguratorForm } from "@/components/public/ConfiguratorForm";
import { getPublicProduct } from "@/lib/public.functions";
import { continueDraftPackage, discardDraftPackage, startPackage } from "@/lib/cart.functions";
import type { PreviewValues, ProductBundle } from "@/lib/catalog";

export const Route = createFileRoute("/build-your-trip/$productId/configure")({
  head: () => ({
    meta: [
      { title: "Configure your experience | West Java Riders" },
      {
        name: "description",
        content:
          "Choose your options for this West Java Riders experience and see your price before adding it to your cart.",
      },
      { property: "og:title", content: "Configure your experience — West Java Riders" },
      {
        property: "og:description",
        content:
          "Choose your options and see your price before adding this experience to your cart.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConfigurePage,
});

function ConfigurePage() {
  const { productId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const loadProduct = useServerFn(getPublicProduct);
  const loadDraft = useServerFn(continueDraftPackage);
  const start = useServerFn(startPackage);
  const discard = useServerFn(discardDraftPackage);
  const [busy, setBusy] = useState(false);

  const product = useQuery({
    queryKey: ["public-product", productId],
    queryFn: () => loadProduct({ data: { productId } }),
  });

  const session = useQuery({
    queryKey: ["public-draft", productId],
    queryFn: async () => {
      const { draft } = await loadDraft();
      if (draft && draft.product_id === productId) return { draft, otherDraft: null };
      if (draft) return { draft: null, otherDraft: draft };
      const created = await start({ data: { productId } });
      return { draft: created.pkg, otherDraft: null };
    },
    enabled: product.isSuccess,
    retry: false,
  });

  async function discardOther() {
    setBusy(true);
    try {
      await discard();
      await queryClient.invalidateQueries({ queryKey: PUBLIC_CART_KEY });
      await session.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That package could not be discarded.");
    } finally {
      setBusy(false);
    }
  }

  if (product.isError) {
    return (
      <PublicPage width="wide">
        <p className="text-sm text-muted-foreground">
          {product.error instanceof Error
            ? product.error.message
            : "This experience is not available."}
        </p>
        <Link to="/build-your-trip" className="cbr-editorial-cta mt-4">
          ← Back
        </Link>
      </PublicPage>
    );
  }

  if (product.isPending || session.isPending) {
    return (
      <PublicPage width="wide">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PublicPage>
    );
  }

  const other = session.data?.otherDraft;

  return (
    <PublicPage width="wide">
      <Link
        to="/build-your-trip/$productId"
        params={{ productId }}
        className="cbr-editorial-cta text-muted-foreground"
      >
        ← Back
      </Link>

      <div className="mt-8">
        {other ? (
          <div className="space-y-5 border-t border-border pt-6">
            <p className="text-sm leading-relaxed">
              You already have a package in progress. Finish it first, or discard it to start this
              one.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="cbr-config-primary !w-auto px-5"
                onClick={() =>
                  navigate({
                    to: "/build-your-trip/$productId/configure",
                    params: { productId: other.product_id as string },
                  })
                }
              >
                Continue current package
              </button>
              <button
                type="button"
                className="cbr-config-nav"
                disabled={busy}
                onClick={discardOther}
              >
                Discard it and start this one
              </button>
            </div>
          </div>
        ) : session.isError ? (
          <p className="text-sm text-destructive">
            {session.error instanceof Error
              ? session.error.message
              : "This experience could not be started."}
          </p>
        ) : (
          session.data?.draft && (
            <ConfiguratorForm
              bundle={product.data!.bundle as unknown as ProductBundle}
              packageId={session.data.draft.id}
              savedAnswers={(session.data.draft.answers ?? null) as PreviewValues | null}
              savedPromo={session.data.draft.promo_code ?? null}
              catalogue={product.data?.catalogue ?? {}}
              productTitle={product.data!.product.title}
              productSummary={product.data!.product.summary}
              imageUrl={product.data!.product.image_url}
            />
          )
        )}
      </div>
    </PublicPage>
  );
}
