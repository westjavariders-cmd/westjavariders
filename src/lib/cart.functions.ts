import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Package + Cart server functions. Anonymous by design (no customer accounts
 * in V1); the cart is identified by an httpOnly session cookie set server-side.
 * Every price here is recomputed server-side; client totals are never trusted.
 */

const answerValue = z.union([
  z.string().max(2000),
  z.number(),
  z.boolean(),
  z.array(z.string().max(500)).max(50),
  z.null(),
]);

const answersSchema = z.record(z.string().max(120), answerValue);
const monthSchema = z.number().int().min(1).max(12).nullable().optional();
const promoSchema = z.string().trim().max(40).nullable().optional();

export const getCart = createServerFn({ method: "POST" }).handler(async () => {
  const { listCart } = await import("@/lib/cart.server");
  return listCart();
});

export const ensureCart = createServerFn({ method: "POST" }).handler(async () => {
  const { currentCart } = await import("@/lib/cart.server");
  const cart = await currentCart(true);
  return { cart };
});

export const startPackage = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { startPackage: start } = await import("@/lib/cart.server");
    return start(data.productId);
  });

export const savePackageConfiguration = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        packageId: z.string().uuid(),
        answers: answersSchema,
        month: monthSchema,
        promoCode: promoSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { savePackage } = await import("@/lib/cart.server");
    const { fxContext, displayAmount } = await import("@/lib/fx.server");
    const { toPublicFx } = await import("@/lib/fx.functions");

    const saved = await savePackage({
      packageId: data.packageId,
      answers: data.answers as never,
      month: data.month ?? null,
      promoCode: data.promoCode ?? null,
    });

    // Presentation only: the authoritative amount stays the Rupiah total.
    const fx = await fxContext();
    return {
      ...saved,
      fx: toPublicFx(fx),
      total_customer: displayAmount(saved.quote.total_idr, fx),
    };
  });

/** Provisional quote without saving. */
export const quotePackageConfiguration = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        productId: z.string().uuid(),
        answers: answersSchema,
        month: monthSchema,
        promoCode: promoSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { quotePackage } = await import("@/lib/cart.server");
    return quotePackage({
      productId: data.productId,
      answers: data.answers as never,
      month: data.month ?? null,
      promoCode: data.promoCode ?? null,
      isGift: false,
    });
  });

export const completePackage = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ packageId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { completePackage: complete } = await import("@/lib/cart.server");
    return complete(data.packageId);
  });

export const removeCartPackage = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ packageId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { removePackage } = await import("@/lib/cart.server");
    return removePackage(data.packageId);
  });

export const continueDraftPackage = createServerFn({ method: "POST" }).handler(async () => {
  const { continueDraft } = await import("@/lib/cart.server");
  return continueDraft();
});

export const discardDraftPackage = createServerFn({ method: "POST" }).handler(async () => {
  const { discardDraft } = await import("@/lib/cart.server");
  return discardDraft();
});
