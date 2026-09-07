import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side Admin operations.
 *
 * Every function that touches data as the signed-in user goes through
 * requireSupabaseAuth so the database RLS policies stay authoritative.
 * The service-role client is only loaded inside handlers, after the caller
 * has been verified as ADMIN, and only for Auth Admin API work that RLS
 * cannot express (creating accounts, listing accounts).
 */

const SAFE_ERROR = "This action could not be completed. Please check your input and try again.";

class AdminError extends Error {}

function fail(message: string): never {
  throw new AdminError(message);
}

type AuthedContext = {
  // Supabase client scoped to the signed-in staff account (RLS applies).
  supabase: any;
  userId: string;
};


async function assertAdmin(supabase: any) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) fail(SAFE_ERROR);
  if (data !== true) fail("Only an ADMIN may perform this operation.");
}

async function writeAudit(
  supabase: any,
  actorId: string,
  action: string,
  entityType: string,
  entityRef: string | null,
  details: Record<string, unknown>,
) {
  await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_ref: entityRef,
    details,
  });
}

/* ------------------------------------------------------------------ */
/* First-admin bootstrap (self-closing, one time only)                */
/* ------------------------------------------------------------------ */

export const getBootstrapState = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true });
  if (error) fail(SAFE_ERROR);
  return { available: (count ?? 0) === 0 };
});

export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(12, "Password must be at least 12 characters."),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count, error: countError } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true });
    if (countError) fail(SAFE_ERROR);
    if ((count ?? 0) > 0) {
      fail("Admin setup has already been completed. Please sign in instead.");
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (createError || !created?.user) {
      fail("This account could not be created. The email may already be in use.");
    }

    const userId = created.user.id;
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "ADMIN" });
    if (roleError) fail(SAFE_ERROR);

    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: userId,
      action: "first_admin_created",
      entity_type: "user_roles",
      entity_ref: data.email,
      details: { role: "ADMIN", bootstrap: true },
    });

    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Settings                                                           */
/* ------------------------------------------------------------------ */

export const updateSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ key: z.string().min(1), value: z.string() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as unknown as AuthedContext).supabase;
    const userId = (context as unknown as AuthedContext).userId;
    await assertAdmin(supabase);

    const { data: existing, error: readError } = await supabase
      .from("settings")
      .select("key, value, value_type")
      .eq("key", data.key)
      .maybeSingle();
    if (readError) fail(SAFE_ERROR);
    if (!existing) fail("This setting does not exist.");

    const raw = data.value.trim();
    if (raw.length === 0) fail("A value is required.");

    // Type-level validation driven by the stored value_type.
    if (existing.value_type === "integer") {
      if (!/^-?\d+$/.test(raw)) fail("This setting must be a whole number.");
    } else if (existing.value_type === "boolean") {
      if (raw !== "true" && raw !== "false") fail("This setting must be true or false.");
    }

    // Key-level business validation.
    if (data.key === "voucher_validity_months") {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) fail("Voucher validity must be a positive whole number of months.");
    }
    if (data.key === "first_payment_percentage") {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0 || n > 100) fail("First payment percentage must be a whole number between 0 and 100.");
    }
    if (data.key === "base_currency") {
      const code = raw.toUpperCase();
      const { data: currency, error } = await supabase
        .from("currencies")
        .select("code, is_active")
        .eq("code", code)
        .maybeSingle();
      if (error) fail(SAFE_ERROR);
      if (!currency) fail("Base currency must match an existing currency code.");
      if (!currency.is_active) fail("Base currency must be an active currency.");
      const { error: updateError } = await supabase
        .from("settings")
        .update({ value: code })
        .eq("key", data.key);
      if (updateError) fail(SAFE_ERROR);
      await writeAudit(supabase, userId, "setting_updated", "settings", data.key, {
        from: existing.value,
        to: code,
      });
      return { ok: true, value: code };
    }

    const { error: updateError } = await supabase
      .from("settings")
      .update({ value: raw })
      .eq("key", data.key);
    if (updateError) fail(SAFE_ERROR);

    await writeAudit(supabase, userId, "setting_updated", "settings", data.key, {
      from: existing.value,
      to: raw,
    });
    return { ok: true, value: raw };
  });

/* ------------------------------------------------------------------ */
/* Base currency / master language (single-row constraints)            */
/* ------------------------------------------------------------------ */

export const setBaseCurrency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ code: z.string().min(3).max(3) }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = (context as unknown as AuthedContext).supabase;
    const userId = (context as unknown as AuthedContext).userId;
    await assertAdmin(supabase);
    const code = data.code.toUpperCase();

    const { data: currency, error } = await supabase
      .from("currencies")
      .select("code, is_active")
      .eq("code", code)
      .maybeSingle();
    if (error) fail(SAFE_ERROR);
    if (!currency) fail("This currency does not exist.");
    if (!currency.is_active) fail("Only an active currency can be the base currency.");

    const { error: clearError } = await supabase
      .from("currencies")
      .update({ is_base: false })
      .eq("is_base", true);
    if (clearError) fail(SAFE_ERROR);

    const { error: setError } = await supabase
      .from("currencies")
      .update({ is_base: true })
      .eq("code", code);
    if (setError) fail(SAFE_ERROR);

    await supabase.from("settings").update({ value: code }).eq("key", "base_currency");

    await writeAudit(supabase, userId, "base_currency_changed", "currencies", code, { to: code });
    return { ok: true };
  });

export const setMasterLanguage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ code: z.string().min(2).max(10) }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = (context as unknown as AuthedContext).supabase;
    const userId = (context as unknown as AuthedContext).userId;
    await assertAdmin(supabase);

    const { data: language, error } = await supabase
      .from("languages")
      .select("code, is_active")
      .eq("code", data.code)
      .maybeSingle();
    if (error) fail(SAFE_ERROR);
    if (!language) fail("This language does not exist.");
    if (!language.is_active) fail("Only an active language can be the master language.");

    const { error: clearError } = await supabase
      .from("languages")
      .update({ is_master: false })
      .eq("is_master", true);
    if (clearError) fail(SAFE_ERROR);

    const { error: setError } = await supabase
      .from("languages")
      .update({ is_master: true })
      .eq("code", data.code);
    if (setError) fail(SAFE_ERROR);

    await writeAudit(supabase, userId, "master_language_changed", "languages", data.code, {
      to: data.code,
    });
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Users and roles                                                    */
/* ------------------------------------------------------------------ */

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = (context as unknown as AuthedContext).supabase;
    await assertAdmin(supabase);

    const { data: roles, error } = await supabase.from("user_roles").select("user_id, role");
    if (error) fail(SAFE_ERROR);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listError) fail(SAFE_ERROR);

    const roleMap = new Map<string, string[]>();
    for (const row of roles ?? []) {
      roleMap.set(row.user_id, [...(roleMap.get(row.user_id) ?? []), row.role as string]);
    }

    return (list?.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      roles: roleMap.get(u.id) ?? [],
    }));
  });

export const createAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(12, "Password must be at least 12 characters."),
        role: z.enum(["ADMIN", "STAFF"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as unknown as AuthedContext).supabase;
    const userId = (context as unknown as AuthedContext).userId;
    await assertAdmin(supabase);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created?.user) {
      fail("This account could not be created. The email may already be in use.");
    }

    // Role insert runs as the calling ADMIN, so RLS still authorises it.
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: created.user.id, role: data.role });
    if (roleError) fail("The account was created but the role could not be assigned.");

    await writeAudit(supabase, userId, "admin_user_created", "user_roles", data.email, {
      role: data.role,
    });
    return { ok: true };
  });

export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["ADMIN", "STAFF"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as unknown as AuthedContext).supabase;
    const actorId = (context as unknown as AuthedContext).userId;
    await assertAdmin(supabase);

    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error) fail("This role could not be assigned. It may already exist.");

    await writeAudit(supabase, actorId, "role_granted", "user_roles", data.userId, {
      role: data.role,
    });
    return { ok: true };
  });

export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["ADMIN", "STAFF"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as unknown as AuthedContext).supabase;
    const actorId = (context as unknown as AuthedContext).userId;
    await assertAdmin(supabase);

    if (data.role === "ADMIN") {
      const { count, error } = await supabase
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "ADMIN");
      if (error) fail(SAFE_ERROR);
      if ((count ?? 0) <= 1) fail("The last remaining ADMIN cannot be removed.");
    }

    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role);
    if (error) fail(SAFE_ERROR);

    await writeAudit(supabase, actorId, "role_revoked", "user_roles", data.userId, {
      role: data.role,
    });
    return { ok: true };
  });
