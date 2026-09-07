import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, LogOut } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ADMIN_NAV } from "@/lib/admin-nav";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

export type AdminSession = { email: string; isAdmin: boolean };

function NavList({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex flex-col gap-0.5 p-3 text-sm">
      {ADMIN_NAV.map((item) => {
        const active = pathname === item.to;
        return (
          <div key={item.to}>
            <Link
              to={item.to}
              onClick={onNavigate}
              className={`flex items-center justify-between rounded-md px-3 py-2 transition-colors ${
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60"
              }`}
            >
              <span>{item.label}</span>
              {item.status === "planned" && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Planned
                </span>
              )}
            </Link>
            {item.children && (
              <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-sidebar-border pl-2">
                {item.children
                  .filter((child) => !child.adminOnly || isAdmin)
                  .map((child) => (
                    <Link
                      key={child.to}
                      to={child.to}
                      onClick={onNavigate}
                      className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                        pathname === child.to
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/60"
                      }`}
                    >
                      {child.label}
                    </Link>
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function AdminLayout({ session }: { session: AdminSession }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <div className="px-5 py-4">
          <p className="text-sm font-semibold tracking-tight text-sidebar-foreground">
            Cimaja Boardriders
          </p>
          <p className="text-xs text-muted-foreground">Admin</p>
        </div>
        <Separator />
        <NavList isAdmin={session.isAdmin} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 overflow-y-auto bg-sidebar p-0">
                <div className="px-5 py-4">
                  <p className="text-sm font-semibold">Cimaja Boardriders</p>
                  <p className="text-xs text-muted-foreground">Admin</p>
                </div>
                <Separator />
                <NavList isAdmin={session.isAdmin} onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="text-sm font-medium lg:hidden">Admin</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight">{session.email}</p>
              <p className="text-xs text-muted-foreground">
                {session.isAdmin ? "ADMIN" : "STAFF"}
              </p>
            </div>
            <Badge variant="secondary" className="sm:hidden">
              {session.isAdmin ? "ADMIN" : "STAFF"}
            </Badge>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumb?: string[];
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {breadcrumb && breadcrumb.length > 0 && (
          <p className="mb-1 text-xs text-muted-foreground">{breadcrumb.join(" / ")}</p>
        )}
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
