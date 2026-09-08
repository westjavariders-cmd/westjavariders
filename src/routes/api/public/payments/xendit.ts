import { createFileRoute } from "@tanstack/react-router";

/**
 * Payment provider notification boundary.
 *
 * The provider request is verified with the provider's own mechanism before
 * anything is read from the body. Every accepted notification is stored once
 * per provider event id, so a replay can never move money twice.
 */
export const Route = createFileRoute("/api/public/payments/xendit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const { applyProviderNotification } = await import("@/lib/purchase.server");
        const result = await applyProviderNotification("xendit", request.headers, raw);
        if (!result.ok) {
          const status = result.reason === "unverified" ? 401 : 400;
          return new Response(JSON.stringify({ received: false }), {
            status,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ received: true, duplicate: result.duplicate }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
