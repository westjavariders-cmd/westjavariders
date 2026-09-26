/**
 * Public contact-us copy and limits. No database and no email provider here.
 */

export const WEBSITE_VISITOR_NAME = "Website visitor";

export const CONTACT_RATE_LIMIT = { max: 5, windowHours: 1 } as const;

export type ContactEmailSource = "cart" | "website";

export function isOverContactRate(
  recentCount: number,
  max: number = CONTACT_RATE_LIMIT.max,
): boolean {
  return recentCount >= max;
}

export function escapeContactHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function composeContactEmail(input: {
  source: ContactEmailSource;
  business: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  voucherDetail: string;
  voucherCodes: string[];
}): { subject: string; text: string; html: string } {
  const name = escapeContactHtml(input.name);
  const email = escapeContactHtml(input.email);
  const phone = escapeContactHtml(input.phone ?? "—");
  const message = escapeContactHtml(input.message).replace(/\n/g, "<br/>");
  const business = escapeContactHtml(input.business);

  if (input.source === "website") {
    return {
      subject: `Website message from ${input.email}`,
      text: [
        `A visitor sent a message from the website of ${input.business}.`,
        "",
        `Email: ${input.email}`,
        "",
        "Message:",
        input.message,
      ].join("\n"),
      html: `<p>A visitor sent a message from the website of ${business}.</p>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Message</strong><br/>${message}</p>`,
    };
  }

  const codes = input.voucherCodes;
  const subject = codes.length
    ? `Customer question — ${codes.join(", ")}`
    : "Customer question from the cart";
  const detail = input.voucherDetail;
  return {
    subject,
    text: [
      `A customer sent a question from the cart on ${input.business}.`,
      "",
      `Name: ${input.name}`,
      `Email: ${input.email}`,
      `WhatsApp / phone: ${input.phone ?? "—"}`,
      "",
      "Message:",
      input.message,
      "",
      "Vouchers in their cart:",
      detail,
    ].join("\n"),
    html: `<p>A customer sent a question from the cart on ${business}.</p>
<p><strong>Name:</strong> ${name}<br/>
<strong>Email:</strong> ${email}<br/>
<strong>WhatsApp / phone:</strong> ${phone}</p>
<p><strong>Message</strong><br/>${message}</p>
<p><strong>Vouchers in their cart</strong></p>
<pre style="font-family:monospace;white-space:pre-wrap">${escapeContactHtml(detail)}</pre>`,
  };
}
