/**
 * Voucher delivery: PDF document then transactional email. Server-only.
 *
 * PAYMENT CONFIRMED -> VOUCHER EXISTS -> GENERATE PDF -> SEND EMAIL
 *
 * Delivery never controls payment. A document or email failure is recorded on
 * the voucher and nothing else changes: no purchase, payment, package or
 * voucher record is created, altered or removed here.
 */
import {
  CONTACT_INCOMPLETE_MESSAGE,
  buildDocumentModel,
  buildEmailContent,
  documentObjectPath,
  readContactSettings,
  resolveRecipients,
  type ContactSettings,
} from "@/lib/voucher-delivery";

const BUCKET = "voucher-documents";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function contactSettings(db: any) {
  const { data } = await db.from("settings").select("key, value").in("key", [
    "business_name",
    "contact_email",
    "contact_whatsapp",
    "contact_location",
  ]);
  return readContactSettings(data ?? []);
}

const VOUCHER_COLUMNS =
  "id, code, voucher_type, status, issued_at, valid_until, validity_months, package_id, purchase_id, customer_id, entitlement, gift_recipient_name, gift_message, document_status, document_path, document_generated_at, email_status, email_attempts, auto_delivery_at";

async function loadVoucher(db: any, voucherId: string) {
  const { data } = await db.from("vouchers").select(VOUCHER_COLUMNS).eq("id", voucherId).maybeSingle();
  return data;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // eslint-disable-next-line no-undef
  return btoa(binary);
}

function randomToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export type DocumentResult =
  | { ok: true; path: string; bytes: Uint8Array; contact: ContactSettings }
  | { ok: false; reason: string };

/**
 * Generates (or regenerates) the voucher PDF from the stored historical
 * entitlement and stores it in the private bucket. The voucher number, package,
 * purchase and entitlement are never touched.
 */
export async function generateVoucherDocument(voucherId: string): Promise<DocumentResult> {
  const db = await admin();
  const voucher = await loadVoucher(db, voucherId);
  if (!voucher) return { ok: false, reason: "This voucher could not be found." };

  const contactCheck = await contactSettings(db);
  if (!contactCheck.ok) {
    await db
      .from("vouchers")
      .update({ document_status: "GENERATION_FAILED", document_error: CONTACT_INCOMPLETE_MESSAGE })
      .eq("id", voucherId);
    return { ok: false, reason: CONTACT_INCOMPLETE_MESSAGE };
  }

  try {
    const model = buildDocumentModel({
      voucher: voucher as any,
      entitlement: voucher.entitlement,
      contact: contactCheck.contact,
    });
    const { renderVoucherPdf } = await import("@/lib/voucher-pdf.server");
    const bytes = await renderVoucherPdf(model);
    const path = documentObjectPath(voucher.id, randomToken());

    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const previous = voucher.document_path as string | null;
    await db
      .from("vouchers")
      .update({
        document_status: "GENERATED",
        document_path: path,
        document_generated_at: new Date().toISOString(),
        document_error: null,
      })
      .eq("id", voucherId);
    if (previous && previous !== path) {
      try {
        await db.storage.from(BUCKET).remove([previous]);
      } catch {
        // A stale document left behind must never fail delivery.
      }
    }

    return { ok: true, path, bytes, contact: contactCheck.contact };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "The document could not be generated.";
    await db
      .from("vouchers")
      .update({ document_status: "GENERATION_FAILED", document_error: message })
      .eq("id", voucherId);
    return { ok: false, reason: message };
  }
}

async function documentBytes(db: any, voucher: any): Promise<{ bytes: Uint8Array; contact: ContactSettings } | null> {
  const contactCheck = await contactSettings(db);
  if (voucher.document_status === "GENERATED" && voucher.document_path && contactCheck.ok) {
    const { data, error } = await db.storage.from(BUCKET).download(voucher.document_path);
    if (!error && data) {
      const buffer = await data.arrayBuffer();
      return { bytes: new Uint8Array(buffer), contact: contactCheck.contact };
    }
  }
  const generated = await generateVoucherDocument(voucher.id);
  if (!generated.ok) return null;
  return { bytes: generated.bytes, contact: generated.contact };
}

export type EmailResult = { sent: boolean; recipient: string | null; reason?: string };

/**
 * Sends the voucher email with the current valid PDF attached. Standard emails
 * go to the voucher user, gift emails to the purchaser; both copy the
 * configured business address.
 */
export async function sendVoucherEmail(
  voucherId: string,
  options?: { automatic?: boolean },
): Promise<EmailResult> {
  const db = await admin();
  const voucher = await loadVoucher(db, voucherId);
  if (!voucher) return { sent: false, recipient: null, reason: "This voucher could not be found." };

  // Automatic delivery happens once per voucher; a payment replay never resends.
  if (options?.automatic && voucher.auto_delivery_at) {
    return { sent: false, recipient: null, reason: "already_delivered" };
  }
  if (options?.automatic) {
    await db.from("vouchers").update({ auto_delivery_at: new Date().toISOString() }).eq("id", voucherId);
  }

  const contactCheck = await contactSettings(db);
  if (!contactCheck.ok) {
    await db
      .from("vouchers")
      .update({ email_status: "SEND_FAILED", email_error: CONTACT_INCOMPLETE_MESSAGE })
      .eq("id", voucherId);
    return { sent: false, recipient: null, reason: CONTACT_INCOMPLETE_MESSAGE };
  }

  const { data: customer } = voucher.customer_id
    ? await db
        .from("customers")
        .select("full_name, email, preferred_language_code")
        .eq("id", voucher.customer_id)
        .maybeSingle()
    : { data: null };

  const recipients = resolveRecipients({
    voucherType: voucher.voucher_type,
    customerEmail: customer?.email ?? null,
    contactEmail: contactCheck.contact.contact_email,
  });

  const attempts = Number(voucher.email_attempts ?? 0) + 1;

  const document = await documentBytes(db, voucher);
  if (!document) {
    const message = "The voucher document is not available, so the email was not sent.";
    await db
      .from("vouchers")
      .update({
        email_status: "SEND_FAILED",
        email_error: message,
        email_attempts: attempts,
        email_recipient: recipients.to || null,
      })
      .eq("id", voucherId);
    return { sent: false, recipient: recipients.to || null, reason: message };
  }

  const model = buildDocumentModel({
    voucher: voucher as any,
    entitlement: voucher.entitlement,
    contact: document.contact,
  });
  const content = buildEmailContent({
    model,
    recipientName: customer?.full_name ?? null,
    language: customer?.preferred_language_code ?? null,
  });

  const { sendEmail } = await import("@/lib/email.server");
  const result = await sendEmail({
    to: recipients.to,
    cc: recipients.cc,
    subject: content.subject,
    html: content.html,
    text: content.text,
    attachments: [
      {
        filename: `${voucher.code}.pdf`,
        contentBase64: toBase64(document.bytes),
        contentType: "application/pdf",
      },
    ],
    idempotencyKey: options?.automatic ? `voucher-${voucher.id}-auto` : `voucher-${voucher.id}-${attempts}`,
  });

  await db
    .from("vouchers")
    .update({
      email_status: result.sent ? "SENT" : "SEND_FAILED",
      email_recipient: recipients.to || null,
      email_sent_at: result.sent ? new Date().toISOString() : null,
      email_error: result.sent ? null : result.message,
      email_attempts: attempts,
    })
    .eq("id", voucherId);

  return {
    sent: result.sent,
    recipient: recipients.to || null,
    ...(result.sent ? {} : { reason: result.message }),
  };
}

/**
 * Automatic delivery after payment confirmation. Runs once per voucher and can
 * never affect the purchase, the payment or the voucher entitlement.
 */
export async function deliverVouchersForPurchase(purchaseId: string): Promise<void> {
  const db = await admin();
  const { data: vouchers } = await db
    .from("vouchers")
    .select("id, auto_delivery_at, status")
    .eq("purchase_id", purchaseId);

  for (const voucher of vouchers ?? []) {
    if (voucher.auto_delivery_at) continue;
    if (voucher.status !== "ACTIVE" && voucher.status !== "PAID") continue;
    await generateVoucherDocument(voucher.id).catch(() => undefined);
    await sendVoucherEmail(voucher.id, { automatic: true }).catch(() => undefined);
  }
}
