/**
 * Contact us — server layer.
 *
 * A customer question is stored once and emailed to the configured business
 * address together with the vouchers of the cart it was sent from, so the
 * administrator immediately sees what the customer was configuring. Nothing
 * here prices, re-quotes, pays or issues anything.
 */
import { currentCart, fail } from "@/lib/cart.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export type ContactInput = {
  full_name: string;
  phone: string | null;
  email: string;
  message: string;
  token?: string;
};

function idr(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `Rp ${Math.round(n).toLocaleString("en-US")}`;
}

function escape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

type VoucherRow = {
  code: string;
  status: string;
  entitlement: any;
  valid_until?: string | null;
  validity_months?: number | string | null;
};

function day(iso: unknown): string {
  if (typeof iso !== "string" || !iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toISOString().slice(0, 10);
}

function voucherText(vouchers: VoucherRow[]): string {
  if (vouchers.length === 0) return "No voucher is associated with this enquiry yet.";
  const blocks: string[] = [];
  for (const v of vouchers) {
    const e = v.entitlement ?? {};
    const lines: string[] = [`Voucher number: ${v.code} (${v.status})`];
    lines.push(
      `  Valid until: ${day(v.valid_until)}${v.validity_months ? ` (${v.validity_months} months)` : ""}`,
    );

    for (const item of Array.isArray(e.items) ? e.items : []) {
      lines.push(`  Experience: ${item.product_title ?? "Experience"}`);
      if (item.base_price_idr != null) lines.push(`  Base price: ${idr(item.base_price_idr)}`);
      for (const o of Array.isArray(item.options) ? item.options : []) {
        lines.push(`  - ${o.label ?? ""}: ${o.value ?? ""}`);
      }
      if (item.people != null) lines.push(`  People: ${item.people}`);
      if (item.quantity != null) lines.push(`  Quantity: ${item.quantity}`);
      for (const b of Array.isArray(item.breakdown) ? item.breakdown : []) {
        lines.push(`  · ${b.label ?? "Option"}: ${idr(b.amount_idr)}`);
      }
      if (item.total_idr != null) lines.push(`  Line total: ${idr(item.total_idr)}`);
    }
    if (e.total_idr != null) lines.push(`  Total: ${idr(e.total_idr)}`);
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n\n");
}

/**
 * Stores the enquiry and emails it to the business address with the vouchers
 * of the current cart attached as readable detail.
 */
export async function submitContactRequest(input: ContactInput): Promise<{
  ok: true;
  emailed: boolean;
  voucher_codes: string[];
}> {
  const name = input.full_name.trim();
  const email = input.email.trim();
  const message = input.message.trim();
  const phone = input.phone?.trim() ? input.phone.trim() : null;
  if (!name || !email.includes("@") || !message) {
    fail("Please add your name, a valid email address and your question.");
  }

  const db = await admin();
  const cart = await currentCart(false, input.token);

  const { data: voucherRows } = cart
    ? await db
        .from("vouchers")
        .select("code, status, entitlement, valid_until, validity_months")
        .eq("cart_id", cart.id)
        .order("code")
    : { data: [] };
  const vouchers: VoucherRow[] = (voucherRows ?? []) as VoucherRow[];
  const codes = vouchers.map((v) => v.code);

  const { data: request } = await db
    .from("contact_requests")
    .insert({
      full_name: name.slice(0, 200),
      phone: phone ? phone.slice(0, 60) : null,
      email: email.slice(0, 320),
      message: message.slice(0, 4000),
      cart_id: cart?.id ?? null,
      voucher_codes: codes as never,
    })
    .select("id")
    .maybeSingle();

  const { data: settings } = await db
    .from("settings")
    .select("key, value")
    .in("key", ["contact_email", "business_name"]);
  const map = new Map<string, string>((settings ?? []).map((r: any) => [r.key, r.value]));
  const to = map.get("contact_email") ?? "";
  const business = map.get("business_name") ?? "West Java Riders";

  const detail = voucherText(vouchers);
  const subject = codes.length
    ? `Customer question — ${codes.join(", ")}`
    : "Customer question from the cart";
  const text = [
    `A customer sent a question from the cart on ${business}.`,
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `WhatsApp / phone: ${phone ?? "—"}`,
    "",
    "Message:",
    message,
    "",
    "Vouchers in their cart:",
    detail,
  ].join("\n");
  const html = `<p>A customer sent a question from the cart on ${escape(business)}.</p>
<p><strong>Name:</strong> ${escape(name)}<br/>
<strong>Email:</strong> ${escape(email)}<br/>
<strong>WhatsApp / phone:</strong> ${escape(phone ?? "—")}</p>
<p><strong>Message</strong><br/>${escape(message).replace(/\n/g, "<br/>")}</p>
<p><strong>Vouchers in their cart</strong></p>
<pre style="font-family:monospace;white-space:pre-wrap">${escape(detail)}</pre>`;

  let emailed = false;
  let error: string | null = null;
  if (to) {
    const { sendEmail } = await import("@/lib/email.server");
    const result = await sendEmail({
      to,
      subject,
      html,
      text,
      ...(request?.id ? { idempotencyKey: `contact-${request.id}` } : {}),
    });
    emailed = result.sent;
    if (!result.sent) error = result.message;
  } else {
    error = "No business contact email is configured yet.";
  }

  if (request?.id) {
    await db
      .from("contact_requests")
      .update({ email_status: emailed ? "SENT" : "SEND_FAILED", email_error: error })
      .eq("id", request.id);
  }

  return { ok: true, emailed, voucher_codes: codes };
}
