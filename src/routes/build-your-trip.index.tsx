import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old Build your trip catalogue is no longer a public menu.
 * Individual products still live at /build-your-trip/$productId.
 */
export const Route = createFileRoute("/build-your-trip/")({
  beforeLoad: () => {
    throw redirect({ to: "/home" });
  },
});
