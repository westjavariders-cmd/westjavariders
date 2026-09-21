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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/build-your-trip/$productId/configure")({
  head: () => ({
    meta: [
      { title: "Configure your experience | Cimaja Boardriders" },
      {
        name: "description",
        content:
          "Choose your options for this Cimaja Boardriders experience and see your price before adding it to your cart.",
      },
      { property: "og:title", content: "Configure your experience — Cimaja Boardriders" },
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
      <PublicPage>
        <p className="text-sm text-muted-foreground">
          {product.error instanceof Error
            ? product.error.message
            : "This experience is not available."}
        </p>
        <Link to="/build-your-trip" className="mt-4 inline-block text-sm underline">
          Back to all experiences
        </Link>
      </PublicPage>
    );
  }

  if (product.isPending || session.isPending) {
    return (
      <PublicPage>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PublicPage>
    );
  }

  const other = session.data?.otherDraft;

  return (
    <PublicPage>
      <Link
        to="/build-your-trip/$productId"
        params={{ productId }}
        className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
      >
        ← Back
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{product.data?.product.title}</h1>
      {product.data?.product.summary && (
        <p className="mt-2 text-sm text-muted-foreground">{product.data.product.summary}</p>
      )}

      <div className="mt-6">
        {other ? (
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-sm">
                You already have a package in progress. Finish it first, or discard it to start this
                one.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    navigate({
                      to: "/build-your-trip/$productId/configure",
                      params: { productId: other.product_id as string },
                    })
                  }
                >
                  Continue current package
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={discardOther}>
                  Discard it and start this one
                </Button>
              </div>
            </CardContent>
          </Card>
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
            />
          )
        )}
      </div>
    </PublicPage>
  );
}
