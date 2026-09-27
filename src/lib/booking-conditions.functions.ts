/**
 * Public read and Admin write for the cart booking-conditions popup.
 * Amounts and payment stay in purchase.server.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BOOKING_CONDITIONS_MAX_CHARS,
  BOOKING_CONDITIONS_SETTING_KEY,
  bookingConditionsAreEmpty,
  sanitizeBookingConditions,
} from "@/lib/booking-conditions";

const SAFE_ERROR = "This action could not be completed. Please check your input and try again.";

class BookingConditionsError extends Error {}
function fail(message: string): never {
  throw new BookingConditionsError(message);
}

async function readBody(db: { from: (table: string) => any }): Promise<string> {
  const { data } = await db
    .from("settings")
    .select("value")
    .eq("key", BOOKING_CONDITIONS_SETTING_KEY)
    .maybeSingle();
  return sanitizeBookingConditions(typeof data?.value === "string" ? data.value : "");
}

export const getBookingConditions = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const body = await readBody(supabaseAdmin as any);
  return { body };
});

export const saveBookingConditions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ body: z.string().max(BOOKING_CONDITIONS_MAX_CHARS) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as { supabase: any; userId: string };
    const { data: isAdmin, error: roleError } = await supabase.rpc("is_admin");
    if (roleError || isAdmin !== true) fail("Only an ADMIN may perform this operation.");

    const body = sanitizeBookingConditions(data.body);
    if (bookingConditionsAreEmpty(body)) fail("The booking conditions cannot be empty.");

    const { data: existing } = await supabase
      .from("settings")
      .select("value")
      .eq("key", BOOKING_CONDITIONS_SETTING_KEY)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("settings")
        .update({ value: body })
        .eq("key", BOOKING_CONDITIONS_SETTING_KEY);
      if (error) fail("The booking conditions could not be saved.");
    } else {
      const { error } = await supabase.from("settings").insert({
        key: BOOKING_CONDITIONS_SETTING_KEY,
        value: body,
        value_type: "string",
        description: "Full booking conditions shown in the cart before payment.",
      });
      if (error) fail("The booking conditions could not be saved until the database update is applied.");
    }

    await supabase.from("admin_audit_log").insert({
      actor_id: userId,
      action: "setting_updated",
      entity_type: "settings",
      entity_ref: BOOKING_CONDITIONS_SETTING_KEY,
      details: { length: body.length },
    });
    return { ok: true, body };
  });
