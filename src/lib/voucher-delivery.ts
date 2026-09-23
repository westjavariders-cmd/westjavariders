/**
 * Pure voucher delivery rules: contact configuration, the printable document
 * model and the two transactional email templates.
 *
 * Nothing here prices, discounts, re-quotes or reads the database. Every value
 * comes from the already-stored Voucher entitlement (built from the immutable
 * Purchase Snapshot) and from the Voucher/Purchase records themselves.
 */
import type { VoucherEntitlement, VoucherType } from "@/lib/voucher";

export const DOCUMENT_STATUSES = ["NOT_GENERATED", "GENERATED", "GENERATION_FAILED"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const EMAIL_STATUSES = ["NOT_SENT", "SENT", "SEND_FAILED"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  NOT_GENERATED: "Not generated",
  GENERATED: "Generated",
  GENERATION_FAILED: "Generation failed",
};

export const EMAIL_STATUS_LABELS: Record<EmailStatus, string> = {
  NOT_SENT: "Not sent",
  SENT: "Sent",
  SEND_FAILED: "Sending failed",
};

/* ------------------------------------------------------------------ */
/* Contact configuration (Admin settings, never hardcoded)             */
/* ------------------------------------------------------------------ */

export type ContactSettings = {
  business_name: string;
  contact_email: string;
  contact_whatsapp: string;
  contact_location: string;
};

export type ContactCheck =
  | { ok: true; contact: ContactSettings }
  | { ok: true; contact: ContactSettings; missing: never[] }
  | { ok: false; missing: string[]; contact: ContactSettings };

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function value(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Reads the customer-facing contact settings. Delivery is blocked while a
 * required value is missing or clearly invalid.
 */
export function readContactSettings(rows: { key: string; value: string }[] | null | undefined): ContactCheck {
  const map = new Map((rows ?? []).map((r) => [r.key, value(r.value)]));
  const contact: ContactSettings = {
    business_name: map.get("business_name") || "Cimaja Boardriders",
    contact_email: map.get("contact_email") ?? "",
    contact_whatsapp: map.get("contact_whatsapp") ?? "",
    contact_location: map.get("contact_location") ?? "",
  };

  const missing: string[] = [];
  if (!contact.contact_email || !EMAIL_SHAPE.test(contact.contact_email)) missing.push("contact_email");
  if (!contact.contact_whatsapp || contact.contact_whatsapp.length < 6) missing.push("contact_whatsapp");

  if (missing.length > 0) return { ok: false, missing, contact };
  return { ok: true, contact };
}

export const CONTACT_INCOMPLETE_MESSAGE =
  "Customer-facing contact details are missing. Add a contact email and a contact WhatsApp number in Settings before vouchers can be sent.";

/* ------------------------------------------------------------------ */
/* Document model                                                      */
/* ------------------------------------------------------------------ */

export type DocumentLine = { label: string; value: string };

export type DocumentModel = {
  business_name: string;
  title: string;
  voucher_code: string;
  voucher_type: VoucherType;
  type_label: string;
  /** Booking reference and money lines. Never present on a gift voucher. */
  commercial: DocumentLine[];
  validity: DocumentLine[];
  experience: {
    package_title: string;
    items: {
      product_title: string;
      options: DocumentLine[];
      people: number | null;
      quantity: number | null;
      /** Money lines are always absent on a gift voucher. */
      base_price: string | null;
      breakdown: DocumentLine[];
      total: string | null;
    }[];
  };

  gift: { recipient_name: string | null; message: string | null } | null;
  holder_name: string | null;
  usage_instructions: string[];
  contact: DocumentLine[];
};

function formatIdrPlain(amount: number): string {
  return `IDR ${Math.round(amount).toLocaleString("en-US")}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

export type DocumentSource = {
  voucher: {
    code: string;
    voucher_type: VoucherType;
    valid_until: string;
    issued_at: string;
    validity_months: number | string;
    gift_recipient_name?: string | null;
    gift_message?: string | null;
  };
  entitlement: VoucherEntitlement | any;
  contact: ContactSettings;
};

/**
 * Builds the printable model. A gift voucher never carries a price, a paid
 * amount, an outstanding amount or a payment status.
 */
export function buildDocumentModel(source: DocumentSource): DocumentModel {
  const { voucher, entitlement, contact } = source;
  const isGift = voucher.voucher_type === "GIFT";

  const commercial: DocumentLine[] = [];
  if (!isGift) {
    if (entitlement?.purchase_reference) {
      commercial.push({ label: "Booking reference", value: String(entitlement.purchase_reference) });
    }
    if (entitlement?.total_idr != null) {
      commercial.push({ label: "Experience value", value: formatIdrPlain(Number(entitlement.total_idr)) });
    }
    const state = entitlement?.payment_state;
    if (state) {
      commercial.push({
        label: "Payment",
        value:
          state === "fully_paid"
            ? "Paid in full"
            : state === "partially_paid"
              ? "Deposit received"
              : "Awaiting payment",
      });
    }
  }

  return {
    business_name: contact.business_name,
    title: isGift ? "Gift Voucher" : "Experience Voucher",
    voucher_code: voucher.code,
    voucher_type: voucher.voucher_type,
    type_label: isGift ? "Gift voucher" : "Standard voucher",
    commercial,
    validity: [
      
      { label: "Issued", value: formatDate(voucher.issued_at) },
      { label: "Valid until", value: formatDate(voucher.valid_until) },
      ...(voucher.validity_months
        ? [{ label: "Validity", value: `${voucher.validity_months} months from purchase` }]
        : []),
      { label: "Dates", value: "Open date — arrange with us any time before the validity date" },
    ],

    experience: {
      package_title: entitlement?.package_title ?? "Your experience",
      items: (entitlement?.items ?? []).map((item: any) => ({
        product_title: item?.product_title ?? "Experience",
        options: (item?.options ?? []).map((o: any) => ({ label: String(o?.label ?? ""), value: String(o?.value ?? "") })),
        people: item?.people ?? null,
        quantity: item?.quantity ?? null,
        base_price:
          isGift || item?.base_price_idr == null ? null : formatIdrPlain(Number(item.base_price_idr)),
        breakdown: isGift
          ? []
          : ((item?.breakdown ?? []) as any[]).map((b) => ({
              label: String(b?.label ?? "Option"),
              value: formatIdrPlain(Number(b?.amount_idr ?? 0)),
            })),
        total: isGift || item?.total_idr == null ? null : formatIdrPlain(Number(item.total_idr)),
      })),

    },
    gift: isGift
      ? {
          recipient_name: voucher.gift_recipient_name ?? entitlement?.recipient_name ?? null,
          message: voucher.gift_message ?? entitlement?.gift_message ?? null,
        }
      : null,
    holder_name: isGift ? null : (entitlement?.customer_name ?? null),
    usage_instructions: [
      `Contact ${contact.business_name} to arrange the dates of your experience.`,
      "Quote your voucher number when you get in touch.",
      "Your voucher has an open date: use it any time before the validity date shown above.",
    ],
    contact: [
      { label: "Email", value: contact.contact_email },
      { label: "Phone", value: contact.contact_whatsapp },
      ...(contact.contact_location ? [{ label: "Where", value: contact.contact_location }] : []),
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Email templates: STANDARD_VOUCHER and GIFT_VOUCHER                  */
/* ------------------------------------------------------------------ */

export const EMAIL_TEMPLATES = ["STANDARD_VOUCHER", "GIFT_VOUCHER"] as const;
export type EmailTemplateName = (typeof EMAIL_TEMPLATES)[number];

export function templateFor(type: VoucherType): EmailTemplateName {
  return type === "GIFT" ? "GIFT_VOUCHER" : "STANDARD_VOUCHER";
}

/** English is the master language; anything else falls back to English. */
export function resolveLanguage(preferred: string | null | undefined): "en" {
  void preferred;
  return "en";
}

export type EmailContent = {
  template: EmailTemplateName;
  language: "en";
  subject: string;
  html: string;
  text: string;
};

function escape(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Renders the transactional email from the resolved document model. No
 * commercial value is computed here: the model already carries everything.
 */
export function buildEmailContent(args: {
  model: DocumentModel;
  recipientName: string | null;
  language?: string | null;
}): EmailContent {
  const { model } = args;
  const isGift = model.voucher_type === "GIFT";
  const language = resolveLanguage(args.language);
  const greeting = args.recipientName ? `Hi ${args.recipientName},` : "Hi,";

  const lines: string[] = [greeting, ""];
  if (isGift) {
    lines.push(
      `Thank you — your gift voucher for ${model.business_name} is ready. The PDF is attached, so you can forward it to ${model.gift?.recipient_name ?? "the person you are giving it to"}.`,
    );
  } else {
    lines.push(
      `Thank you — your booking with ${model.business_name} is confirmed and your voucher is attached as a PDF.`,
    );
  }
  lines.push("");
  lines.push(`Voucher number: ${model.voucher_code}`);
  lines.push(`Experience: ${model.experience.package_title}`);
  for (const line of model.validity) lines.push(`${line.label}: ${line.value}`);
  if (!isGift) for (const line of model.commercial) lines.push(`${line.label}: ${line.value}`);
  // What was booked, package by package: name, price and the customer's choices.
  for (const item of model.experience.items) {
    lines.push("");
    lines.push(item.product_title);
    for (const o of item.options) {
      lines.push(`  ${o.label}`);
      lines.push(`    ${o.value}`);
    }
    if (item.base_price) lines.push(`  Base price: ${item.base_price}`);
    for (const b of item.breakdown) lines.push(`  ${b.label}: ${b.value}`);
    if (item.total) lines.push(`  Package total: ${item.total}`);
    if (item.people != null) lines.push(`  People: ${item.people}`);
    if (item.quantity != null) lines.push(`  Quantity: ${item.quantity}`);
  }
  if (isGift && model.gift?.message) {
    lines.push("");
    lines.push(`Your message: ${model.gift.message}`);
  }
  lines.push("");
  for (const step of model.usage_instructions) lines.push(`- ${step}`);
  lines.push("");
  for (const line of model.contact) lines.push(`${line.label}: ${line.value}`);


  const text = lines.join("\n");

  const html = `<!doctype html><html lang="${language}"><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<div style="max-width:560px;margin:0 auto;padding:24px">
<p style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#0f766e;margin:0 0 8px">${escape(model.business_name)}</p>
<h1 style="font-size:22px;margin:0 0 16px">${escape(model.title)}</h1>
<p style="font-size:15px;line-height:1.6;margin:0 0 16px">${escape(greeting)}</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 16px">${escape(lines[2] ?? "")}</p>
<table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 16px">
<tr><td style="padding:6px 0;color:#6b7280">Voucher number</td><td style="padding:6px 0;text-align:right;font-weight:bold">${escape(model.voucher_code)}</td></tr>
<tr><td style="padding:6px 0;color:#6b7280">Experience</td><td style="padding:6px 0;text-align:right">${escape(model.experience.package_title)}</td></tr>
${model.validity.map((l) => `<tr><td style="padding:6px 0;color:#6b7280">${escape(l.label)}</td><td style="padding:6px 0;text-align:right">${escape(l.value)}</td></tr>`).join("")}
${isGift ? "" : model.commercial.map((l) => `<tr><td style="padding:6px 0;color:#6b7280">${escape(l.label)}</td><td style="padding:6px 0;text-align:right">${escape(l.value)}</td></tr>`).join("")}
</table>
${model.experience.items
    .map(
      (item) => `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin:0 0 12px">
<p style="font-size:15px;font-weight:bold;margin:0 0 10px">${escape(item.product_title)}</p>
${item.options
  .map(
    (o) => `<p style="font-size:12px;color:#6b7280;margin:10px 0 0">${escape(o.label)}</p>
<p style="font-size:14px;font-weight:bold;margin:2px 0 0">${escape(o.value)}</p>`,
  )
  .join("")}
<table role="presentation" style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px">
${item.base_price ? `<tr><td style="padding:3px 0;color:#6b7280">Base price</td><td style="padding:3px 0;text-align:right">${escape(item.base_price)}</td></tr>` : ""}
${item.breakdown.map((b) => `<tr><td style="padding:3px 0;color:#6b7280">${escape(b.label)}</td><td style="padding:3px 0;text-align:right">${escape(b.value)}</td></tr>`).join("")}
${item.total ? `<tr><td style="padding:3px 0;font-weight:bold">Package total</td><td style="padding:3px 0;text-align:right;font-weight:bold">${escape(item.total)}</td></tr>` : ""}
${item.people != null ? `<tr><td style="padding:3px 0;color:#6b7280">People</td><td style="padding:3px 0;text-align:right">${item.people}</td></tr>` : ""}
${item.quantity != null ? `<tr><td style="padding:3px 0;color:#6b7280">Quantity</td><td style="padding:3px 0;text-align:right">${item.quantity}</td></tr>` : ""}
</table></div>`,
    )
    )
    .join("")}
${isGift && model.gift?.message ? `<p style="font-size:15px;line-height:1.6;font-style:italic;background:#f9fafb;padding:12px;border-radius:8px;margin:0 0 16px">${escape(model.gift.message)}</p>` : ""}

<ul style="font-size:14px;line-height:1.6;padding-left:18px;margin:0 0 16px">${model.usage_instructions.map((s) => `<li>${escape(s)}</li>`).join("")}</ul>
<p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0">${model.contact.map((l) => `${escape(l.label)}: ${escape(l.value)}`).join("<br>")}</p>
</div></body></html>`;

  return {
    template: templateFor(model.voucher_type),
    language,
    subject: isGift
      ? `Your ${model.business_name} gift voucher ${model.voucher_code}`
      : `Your ${model.business_name} voucher ${model.voucher_code}`,
    html,
    text,
  };
}

/**
 * A standard voucher email goes to the voucher user; a gift voucher email goes
 * to the purchaser, who forwards it. Both copy the configured business email.
 */
export function resolveRecipients(args: {
  voucherType: VoucherType;
  customerEmail: string | null | undefined;
  contactEmail: string;
}): { to: string; cc: string[]; role: "voucher_user" | "purchaser" } {
  const to = value(args.customerEmail);
  return {
    to,
    cc: value(args.contactEmail) && value(args.contactEmail).toLowerCase() !== to.toLowerCase() ? [args.contactEmail] : [],
    role: args.voucherType === "GIFT" ? "purchaser" : "voucher_user",
  };
}

/** A voucher document path must never be guessable from the voucher number. */
export function documentObjectPath(voucherId: string, token: string): string {
  return `${voucherId}/${token}.pdf`;
}
