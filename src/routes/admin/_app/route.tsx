import { createFileRoute, redirect } from "@tanstack/react-router";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/_app")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/admin/login" });

    // The database decides: no ADMIN/STAFF role means no Admin application.
    const [{ data: staff }, { data: admin }] = await Promise.all([
      supabase.rpc("is_staff_or_admin"),
      supabase.rpc("is_admin"),
    ]);
    if (staff !== true) throw redirect({ to: "/admin/no-access" });

    return {
      adminSession: { email: data.user.email ?? "", isAdmin: admin === true },
    };
  },
  component: AdminShell,
});

function AdminShell() {
  const { adminSession } = Route.useRouteContext();
  return <AdminLayout session={adminSession} />;
}
