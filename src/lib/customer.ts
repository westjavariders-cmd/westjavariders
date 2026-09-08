/**
 * Pure customer-contact rules. No database, no framework.
 *
 * A Customer is a real-world contact for the commercial and operational
 * lifecycle of a booking — never a user account. Only the fields that the
 * booking lifecycle genuinely needs are collected.
 */

export type CustomerContactInput = {
  full_name?: unknown;
  email?: unknown;
  phone?: unknown;
  country?: unknown;
  preferred_language_code?: unknown;
};

export type CustomerContact = {
  full_name: string;
  email: string;
  phone: string;
  country: string | null;
  preferred_language_code: string | null;
};

export class CustomerError extends Error {}

function customerFail(message: string): never {
  throw new CustomerError(message);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

/** Email is the conservative identity key: trimmed and lowercased. */
export function normaliseEmail(value: unknown): string {
  return text(value).toLowerCase();
}

/** Keeps a leading + and digits only, so the same number matches itself. */
export function normalisePhone(value: unknown): string {
  const raw = text(value);
  const plus = raw.startsWith("+") ? "+" : "";
  return plus + raw.replace(/[^0-9]/g, "");
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Validates and normalises the contact details supplied at checkout.
 * Every message is written for the customer reading the checkout page.
 */
export function validateCustomerContact(input: CustomerContactInput): CustomerContact {
  const full_name = text(input.full_name);
  if (full_name.length < 2) customerFail("Please enter your full name.");
  if (full_name.length > 120) customerFail("Please enter a shorter name.");

  const email = normaliseEmail(input.email);
  if (!EMAIL.test(email) || email.length > 160) {
    customerFail("Please enter a valid email address.");
  }

  const phone = normalisePhone(input.phone);
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 6 || digits.length > 20) {
    customerFail("Please enter a valid phone or WhatsApp number.");
  }

  const country = text(input.country) || null;
  if (country && country.length > 80) customerFail("Please enter a shorter country name.");

  const language = text(input.preferred_language_code).toLowerCase() || null;
  if (language && !/^[a-z]{2}(-[a-z0-9]{2,8})?$/.test(language)) {
    customerFail("That language is not available.");
  }

  return { full_name, email, phone, country, preferred_language_code: language };
}

export const PURCHASE_FULFILLMENT_STATUSES = ["not_started", "in_progress", "completed"] as const;
export type PurchaseFulfillmentStatus = (typeof PURCHASE_FULFILLMENT_STATUSES)[number];

/**
 * Operational state, kept strictly separate from the commercial/payment
 * state on the same purchase. Cancellations and refunds stay commercial
 * concerns and are not modelled here.
 */
export const PURCHASE_FULFILLMENT_LABELS: Record<PurchaseFulfillmentStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};
