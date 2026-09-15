/**
 * The promo code the customer entered on the Home page, kept in their browser
 * so every experience they configure quotes with it. Browser-only helpers.
 */
const KEY = "cbr_promo_code";

export function readStoredPromoCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    const code = raw?.trim().toUpperCase() ?? "";
    return code ? code.slice(0, 40) : null;
  } catch {
    return null;
  }
}

export function writeStoredPromoCode(code: string): void {
  if (typeof window === "undefined") return;
  const clean = code.trim().toUpperCase().slice(0, 40);
  try {
    if (clean) window.localStorage.setItem(KEY, clean);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export function clearStoredPromoCode(): void {
  writeStoredPromoCode("");
}
