/**
 * Direct catalogue booking — public server functions.
 *
 * Everything returned here is customer-safe (no supplier costs). The amount
 * is always recomputed on the server from the live catalogue at booking time
 * and again inside checkout revalidation; the browser never sends a price.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const choices = z.object({
  nights: z.number().int().min(1).max(365).nullish(),
  days: z.number().int().min(1).max(365).nullish(),
  people: z.number().int().min(1).max(100).nullish(),
  hours: z.number().int().min(1).max(72).nullish(),
});

const itemInput = z.object({
  catalogueId: z.string().uuid(),
  itemId: z.string().uuid(),
});

/** One bookable catalogue item with its live price shape. */
export const getBookableItem = createServerFn({ method: "POST" })
  .inputValidator((data) => itemInput.parse(data))
  .handler(async ({ data }) => {
    const { bookableItem } = await import("@/lib/direct-booking.server");
    return { result: await bookableItem(data.catalogueId, data.itemId) };
  });

/**
 * Adds one direct booking to the cart. Any failure is a plain-language
 * message; the cart keeps its single configured draft untouched.
 */
export const bookCatalogueItem = createServerFn({ method: "POST" })
  .inputValidator((data) => itemInput.extend({ choices }).parse(data))
  .handler(async ({ data }) => {
    const { addDirectBookingToCart } = await import("@/lib/direct-booking.server");
    return addDirectBookingToCart({
      catalogueId: data.catalogueId,
      itemId: data.itemId,
      choices: {
        nights: data.choices.nights ?? null,
        days: data.choices.days ?? null,
        people: data.choices.people ?? null,
        hours: data.choices.hours ?? null,
      },
    });
  });
