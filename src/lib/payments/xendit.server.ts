/**
 * Xendit adapter. Server-only.
 *
 * Credentials come from environment variables:
 *   XENDIT_SECRET_KEY     - API secret key (sandbox or live)
 *   XENDIT_CALLBACK_TOKEN - callback verification token for webhooks
 *
 * Xendit verifies webhooks with the `x-callback-token` header, which must equal
 * the account's callback token. That is the provider's official mechanism; no
 * substitute is accepted here and a browser can never satisfy it.
 */
import type {
  PaymentLinkRequest,
  PaymentLinkResult,
  PaymentProvider,
  ProviderNotification,
} from "./provider.server";

const API = "https://api.xendit.co/v2/invoices";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function mapStatus(status: string): ProviderNotification["status"] {
  switch (status.toUpperCase()) {
    case "PAID":
    case "SETTLED":
      return "paid";
    case "PENDING":
      return "pending";
    case "EXPIRED":
      return "expired";
    case "FAILED":
      return "failed";
    case "VOIDED":
    case "CANCELLED":
      return "cancelled";
    default:
      return "unknown";
  }
}

export function xenditProvider(): PaymentProvider {
  return {
    name: "xendit",

    async createPaymentLink(request: PaymentLinkRequest): Promise<PaymentLinkResult> {
      const key = process.env['XENDIT_SECRET_KEY'];
      if (!key) throw new Error("The payment provider is not configured.");

      const response = await fetch(API, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Basic ${btoa(`${key}:`)}`,
        },
        body: JSON.stringify({
          // external_id carries our own payment request id back to us.
          external_id: request.paymentRequestId,
          amount: request.amountIdr,
          currency: request.currencyCode,
          description: request.description,
          success_redirect_url: request.returnUrl,
          failure_redirect_url: request.returnUrl,
        }),
      });

      if (!response.ok) {
        throw new Error("The payment provider rejected this request.");
      }
      const body = (await response.json()) as {
        id?: string;
        invoice_url?: string;
        expiry_date?: string;
      };
      if (!body.id || !body.invoice_url) {
        throw new Error("The payment provider returned an unexpected response.");
      }
      return {
        provider: "xendit",
        reference: body.id,
        url: body.invoice_url,
        expiresAt: body.expiry_date ?? null,
      };
    },

    verifyNotification(headers: Headers): boolean {
      const expected = process.env['XENDIT_CALLBACK_TOKEN'];
      const received = headers.get("x-callback-token");
      if (!expected || !received) return false;
      return timingSafeEqual(received, expected);
    },

    parseNotification(payload: unknown): ProviderNotification | null {
      if (payload == null || typeof payload !== "object") return null;
      const p = payload as Record<string, unknown>;
      const id = typeof p['id'] === "string" ? p['id'] : null;
      const externalId = typeof p['external_id'] === "string" ? p['external_id'] : null;
      const status = typeof p['status'] === "string" ? p['status'] : "";
      if (!id || !status) return null;
      // Xendit invoice callbacks are identified by invoice id + status.
      return {
        eventId: `${id}:${status.toUpperCase()}`,
        paymentRequestId: externalId,
        reference: id,
        eventType: `invoice.${status.toLowerCase()}`,
        status: mapStatus(status),
        amountIdr: typeof p['paid_amount'] === "number"
          ? Math.round(p['paid_amount'])
          : typeof p['amount'] === "number"
            ? Math.round(p['amount'])
            : null,
      };
    },
  };
}
