import { createFileRoute, Outlet } from "@tanstack/react-router";

// The Admin application depends on a browser-held session, so it is rendered
// client-side only.
export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin | Cimaja Boardriders" },
      { name: "description", content: "Internal operations console for Cimaja Boardriders." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => <Outlet />,
});
