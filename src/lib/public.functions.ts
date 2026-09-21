import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public (anonymous) reads for Build Your Trip and the Cart. Server-authoritative. */

export const listPublicProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { listPurchasableProducts } = await import("@/lib/public-catalog.server");
  return { products: await listPurchasableProducts() };
});

export const getPublicProduct = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { publicProductBundle } = await import("@/lib/public-catalog.server");
    return publicProductBundle(data.productId);
  });

export const getPublicProductIntro = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { publicProductIntro } = await import("@/lib/public-catalog.server");
    return publicProductIntro(data.productId);
  });

export const getPublicCart = createServerFn({ method: "POST" }).handler(async () => {
  const { publicCart } = await import("@/lib/public-catalog.server");
  return publicCart();
});
