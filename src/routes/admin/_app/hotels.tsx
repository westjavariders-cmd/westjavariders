import { createFileRoute } from "@tanstack/react-router";

import { PlaceholderModule } from "@/components/admin/PlaceholderModule";

export const Route = createFileRoute("/admin/_app/hotels")({
  component: () => <PlaceholderModule title="Hotels / Rooms" />,
});
