/**
 * Fixed interface strings of the public site.
 *
 * The English text is the key: components call `t("Add to cart")` and get the
 * translation for the visitor's language, or the English text when there is
 * none. No parallel translation system — the translations live in the shared
 * `text_translations` table.
 */

export const UI_STRINGS: string[] = [
  // Header and navigation
  "Your cart",
  "Cart",
  "TOTAL PRICE",
  "View your cart",
  "My trip",
  "Currency",
  "Language",
  "Open menu",
  "Close menu",
  "Build your trip",
  "Contact us",
  // Configurator
  "Add to cart",
  "Back",
  "Next",
  "Your price",
  "Price unavailable.",
  "Nothing to choose in this step.",
  "Promo code",
  "View details",
  "Hide details",
  "Previous photo",
  "Next photo",
  "Prices set in IDR (RP). Your bank sets the final exchange rate.",
  // Cart
  "Your cart is empty.",
  "To pay now",
  "Balance",
  "Total price",
  "Pay now",
  "Remove",
  "Continue",
  "Discard",
  "SHARE YOUR TRIP",
  "Share your trip",
  "Preparing link…",
  "Share your trip with your travel companions.",
  "Share this link with your travel companions:",
  "Copy link",
  "Link copied.",
  "DO YOU HAVE ANY QUESTIONS? CONTACT US",
  "Full name",
  "Email",
  "WhatsApp / phone",
  "Your question",
  "Send",
  "Cancel",
  "Thank you",
  "This is a gift",
  "Who is it for? (optional)",
  "Your message (optional)",
  "Country (optional)",
  "Phone / WhatsApp",
  "Enter a code",
  "Continue current package",
  "Balance, settled with us before your trip",
  "Opening payment…",
  "Sending…",
  "SEND",
  "Adding…",
  "Updating price…",
  "Not finished yet, so it is not part of your total.",
  "Loading…",

];

export type UiStringMap = Record<string, string>;

/** Translation lookup with the English text as the fallback. */
export function makeTranslator(map: UiStringMap | undefined) {
  return (text: string) => (map && map[text]) || text;
}
