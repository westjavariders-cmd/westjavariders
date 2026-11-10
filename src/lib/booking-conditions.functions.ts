/**
 * Public read and Admin write for cart explainer popups (conditions + gift).
 * Amounts and payment stay in purchase.server.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BOOKING_CONDITIONS_MAX_CHARS,
  BOOKING_CONDITIONS_SETTING_KEY,
  GIFT_EXPLANATION_SETTING_KEY,
  bookingConditionsAreEmpty,
  sanitizeBookingConditions,
} from "@/lib/booking-conditions";

class BookingConditionsError extends Error {}
function fail(message: string): never {
  throw new BookingConditionsError(message);
}

async function readBody(db: { from: (table: string) => any }, key: string): Promise<string> {
  const { data } = await db.from("settings").select("value").eq("key", key).maybeSingle();
  return sanitizeBookingConditions(typeof data?.value === "string" ? data.value : "");
}

export const getBookingConditions = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const [body, gift_body] = await Promise.all([
    readBody(db, BOOKING_CONDITIONS_SETTING_KEY),
    readBody(db, GIFT_EXPLANATION_SETTING_KEY),
  ]);
  return { body, gift_body };
});

async function savePlainSetting(
  supabase: any,
  userId: string,
  key: string,
  raw: string,
  description: string,
  emptyMessage: string,
  applyMessage: string,
) {
  const { data: isAdmin, error: roleError } = await supabase.rpc("is_admin");
  if (roleError || isAdmin !== true) fail("Only an ADMIN may perform this operation.");

  const body = sanitizeBookingConditions(raw);
  if (bookingConditionsAreEmpty(body)) fail(emptyMessage);

  const { data: existing } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();

  if (existing) {
    const { error } = await supabase.from("settings").update({ value: body }).eq("key", key);
    if (error) fail("This text could not be saved.");
  } else {
    const { error } = await supabase.from("settings").insert({
      key,
      value: body,
      value_type: "string",
      description,
    });
    if (error) fail(applyMessage);
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: userId,
    action: "setting_updated",
    entity_type: "settings",
    entity_ref: key,
    details: { length: body.length },
  });
  return { ok: true as const, body };
}

export const saveBookingConditions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ body: z.string().max(BOOKING_CONDITIONS_MAX_CHARS) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as { supabase: any; userId: string };
    return savePlainSetting(
      supabase,
      userId,
      BOOKING_CONDITIONS_SETTING_KEY,
      data.body,
      "Full booking conditions shown in the cart before payment.",
      "The booking conditions cannot be empty.",
      "The booking conditions could not be saved until the database update is applied.",
    );
  });

export const saveGiftExplanation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ body: z.string().max(BOOKING_CONDITIONS_MAX_CHARS) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as { supabase: any; userId: string };
    return savePlainSetting(
      supabase,
      userId,
      GIFT_EXPLANATION_SETTING_KEY,
      data.body,
      "Explanation of This is a gift, shown in an optional cart popup.",
      "The gift explanation cannot be empty.",
      "The gift explanation could not be saved until the database update is applied.",
    );
  });
