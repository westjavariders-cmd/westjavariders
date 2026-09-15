import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Save & share your trip. Anonymous like the rest of the cart: no account, no
 * personal data. Prices are always recomputed server-side on reopen.
 */

const codeSchema = z.object({ code: z.string().trim().min(3).max(20) });

export const saveTrip = createServerFn({ method: "POST" }).handler(async () => {
  const { saveCurrentTrip } = await import("@/lib/saved-trip.server");
  return saveCurrentTrip();
});

export const getSavedTrip = createServerFn({ method: "POST" })
  .inputValidator((data) => codeSchema.parse(data))
  .handler(async ({ data }) => {
    const { readSavedTrip } = await import("@/lib/saved-trip.server");
    return { trip: await readSavedTrip(data.code) };
  });

export const loadSavedTrip = createServerFn({ method: "POST" })
  .inputValidator((data) => codeSchema.parse(data))
  .handler(async ({ data }) => {
    const { loadSavedTripIntoCart } = await import("@/lib/saved-trip.server");
    return { result: await loadSavedTripIntoCart(data.code) };
  });
