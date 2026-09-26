import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/build-your-trip/$productId")({
  component: ProductLayout,
});

function ProductLayout() {
  return <Outlet />;
}
