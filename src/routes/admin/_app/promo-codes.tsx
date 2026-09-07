import { createFileRoute } from "@tanstack/react-router";

import { PlaceholderModule } from "@/components/admin/PlaceholderModule";

export const Route = createFileRoute("/admin/_app/promo-codes")({
  component: () => <PlaceholderModule title="Promo Codes" />,
});
