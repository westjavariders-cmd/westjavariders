/**
 * Visitor language preference — server-only.
 *
 * The list of languages is the existing managed `languages` table; the master
 * language is the fallback. The visitor's choice is stored in a cookie so the
 * very first render (SSR) already uses it. No parallel translation system.
 */
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

export const LANGUAGE_COOKIE = "cbr_language";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export type PublicLanguage = { code: string; name: string; is_master: boolean };

/** Active languages, in configured order. */
export async function listPublicLanguages(): Promise<PublicLanguage[]> {
  const db = await admin();
  const { data } = await db
    .from("languages")
    .select("code, name, is_master, is_active, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  return (data ?? []).map((row: any) => ({
    code: String(row.code),
    name: String(row.name),
    is_master: row.is_master === true,
  }));
}

const CODE_RE = /^[A-Za-z]{2}(-[A-Za-z0-9]{2,8})?$/;

function readCookieLanguage(): string | null {
  try {
    const header = getRequest().headers.get("cookie");
    if (!header) return null;
    for (const part of header.split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name === LANGUAGE_COOKIE) {
        const value = decodeURIComponent(rest.join("="));
        return CODE_RE.test(value) ? value : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function writeCookieLanguage(code: string) {
  setResponseHeader(
    "Set-Cookie",
    `${LANGUAGE_COOKIE}=${encodeURIComponent(code)}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${
      60 * 60 * 24 * 180
    }`,
  );
}

/**
 * The language for this request: an explicit choice, else the stored choice,
 * else null so existing callers keep falling back to the master language.
 */
export async function resolveLanguage(explicit?: string | null): Promise<string | null> {
  const languages = await listPublicLanguages();
  const supported = new Set(languages.map((l) => l.code));
  for (const candidate of [explicit, readCookieLanguage()]) {
    if (candidate && supported.has(candidate)) return candidate;
  }
  return null;
}

/** Stores the visitor's explicit choice for later requests. */
export async function selectLanguage(code: string): Promise<{ code: string | null }> {
  const resolved = await resolveLanguage(code);
  if (resolved) writeCookieLanguage(resolved);
  return { code: resolved };
}
