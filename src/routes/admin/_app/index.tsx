import { createFileRoute, Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/admin/AdminLayout";
import { ADMIN_NAV } from "@/lib/admin-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/_app/")({
  component: AdminHome,
});

function AdminHome() {
  const { adminSession } = Route.useRouteContext();
  const planned = ADMIN_NAV.filter((item) => item.status === "planned");

  return (
    <>
      <PageHeader
        title="Admin home"
        description="Operational console for the Cimaja Boardriders platform."
        breadcrumb={["Admin", "Home"]}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Signed in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{adminSession.email}</p>
            <Badge variant="secondary">{adminSession.isAdmin ? "ADMIN" : "STAFF"}</Badge>
            <p className="text-muted-foreground">
              {adminSession.isAdmin
                ? "Full Admin access, including configuration, roles and audit."
                : "Staff access. Configuration is read-only and roles cannot be managed."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Available now</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5 text-sm">
            <Link to="/admin/settings" className="underline underline-offset-2">
              Settings
            </Link>
            <Link to="/admin/settings/currencies" className="underline underline-offset-2">
              Currencies
            </Link>
            <Link to="/admin/settings/languages" className="underline underline-offset-2">
              Languages
            </Link>
            <Link to="/admin/settings/markets" className="underline underline-offset-2">
              Markets
            </Link>
            <Link to="/admin/settings/audit" className="underline underline-offset-2">
              Audit log
            </Link>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Not implemented yet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-sm text-muted-foreground">
              These modules appear in the navigation but belong to later build phases.
            </p>
            <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {planned.map((item) => (
                <li key={item.to} className="text-muted-foreground">
                  {item.label}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
