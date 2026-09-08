/**
 * Payment provider boundary.
 *
 * PURCHASE / PAYMENT CORE -> PAYMENT PROVIDER INTERFACE -> ADAPTER (Xendit)
 *
 * Nothing above this file knows any provider field name. Adapters are only
 * loaded when their credentials are configured as server environment
 * variables; no key ever reaches the browser.
 */

export type PaymentLinkRequest = {
  paymentRequestId: string;
  purchaseId: string;
  amountIdr: number;
  currencyCode: string;
  description: string;
  returnUrl: string;
};

export type PaymentLinkResult = {
  provider: string;
  reference: string;
  url: string;
  expiresAt: string | null;
};

export type ProviderNotification = {
  /** Provider event id used for idempotency. */
  eventId: string;
  /** Our own payment request id, echoed back by the provider. */
  paymentRequestId: string | null;
  /** Provider reference for the payment. */
  reference: string | null;
  eventType: string;
  /** Provider-neutral outcome. */
  status: "paid" | "pending" | "failed" | "expired" | "cancelled" | "unknown";
  amountIdr: number | null;
};

export interface PaymentProvider {
  readonly name: string;
  createPaymentLink(request: PaymentLinkRequest): Promise<PaymentLinkResult>;
  /** Verifies the provider request with the provider's own mechanism. */
  verifyNotification(headers: Headers): boolean;
  parseNotification(payload: unknown): ProviderNotification | null;
}

/**
 * The configured provider, or null when no credentials are present.
 * A missing provider never breaks Purchase creation: the payment request is
 * still recorded and a link can be generated later from Admin.
 */
export async function activePaymentProvider(): Promise<PaymentProvider | null> {
  if (process.env['XENDIT_SECRET_KEY']) {
    const { xenditProvider } = await import("./xendit.server");
    return xenditProvider();
  }
  return null;
}

export async function providerByName(name: string): Promise<PaymentProvider | null> {
  if (name === "xendit") {
    const { xenditProvider } = await import("./xendit.server");
    return xenditProvider();
  }
  return null;
}
