/**
 * Minimal transactional email boundary. Server-only.
 *
 * One function, one provider call. Credentials stay in server environment
 * variables and never reach the browser. When no provider is configured the
 * call reports `not_configured` so the application-side delivery structure
 * stays testable without production credentials.
 */

export type EmailAttachment = { filename: string; contentBase64: string; contentType: string };

export type OutgoingEmail = {
  to: string;
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  /** Stable key so a repeated send of the same voucher is not duplicated. */
  idempotencyKey?: string;
};

export type EmailSendResult =
  | { sent: true; provider: string }
  | { sent: false; reason: "not_configured" | "provider_error" | "invalid_recipient"; message: string };

const SEND_ENDPOINT = "https://api.lovable.dev/v1/email/send";

function senderDomain(): string | null {
  const raw = process.env["EMAIL_SENDER_DOMAIN"];
  return raw && raw.trim() ? raw.trim() : null;
}

/** Sends one email. Never throws: delivery failures are reported, not raised. */
export async function sendEmail(email: OutgoingEmail): Promise<EmailSendResult> {
  if (!email.to || !email.to.includes("@")) {
    return { sent: false, reason: "invalid_recipient", message: "No valid recipient address." };
  }

  const apiKey = process.env["LOVABLE_API_KEY"];
  const domain = senderDomain();
  if (!apiKey || !domain) {
    return {
      sent: false,
      reason: "not_configured",
      message: "No email sender is configured yet, so the email was not sent.",
    };
  }

  try {
    const response = await fetch(SEND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        ...(email.idempotencyKey ? { "idempotency-key": email.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: `${domain}`,
        to: email.to,
        cc: email.cc ?? [],
        subject: email.subject,
        html: email.html,
        text: email.text,
        attachments: (email.attachments ?? []).map((a) => ({
          filename: a.filename,
          content: a.contentBase64,
          content_type: a.contentType,
        })),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        sent: false,
        reason: "provider_error",
        message: `The email provider refused the message (${response.status}). ${detail.slice(0, 200)}`.trim(),
      };
    }
    return { sent: true, provider: "lovable" };
  } catch (error) {
    return {
      sent: false,
      reason: "provider_error",
      message: error instanceof Error ? error.message.slice(0, 300) : "The email could not be sent.",
    };
  }
}

export function emailConfigured(): boolean {
  return Boolean(process.env["LOVABLE_API_KEY"] && senderDomain());
}
