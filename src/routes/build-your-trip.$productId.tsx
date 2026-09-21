import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/build-your-trip/$productId")({
  component: ProductIdLayout,
});

function ProductIdLayout() {
  return <Outlet />;
}
