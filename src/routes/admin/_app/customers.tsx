import { createFileRoute } from "@tanstack/react-router";

import { PlaceholderModule } from "@/components/admin/PlaceholderModule";

export const Route = createFileRoute("/admin/_app/customers")({
  component: () => <PlaceholderModule title="Customers" />,
});
