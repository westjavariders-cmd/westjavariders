import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { bootstrapFirstAdmin, getBootstrapState } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin/setup")({
  component: AdminSetup,
});

function AdminSetup() {
  const checkState = useServerFn(getBootstrapState);
  const createFirstAdmin = useServerFn(bootstrapFirstAdmin);
  const state = useQuery({ queryKey: ["bootstrap-state"], queryFn: () => checkState() });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createFirstAdmin({ data: { email, password } });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "This account could not be created.");
    } finally {
      setBusy(false);
    }
  }

  const available = state.data?.available === true;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">First-time Admin setup</CardTitle>
          <CardDescription>
            This page creates the very first ADMIN account and then closes permanently.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state.isLoading && <p className="text-sm text-muted-foreground">Checking…</p>}

          {!state.isLoading && !available && !done && (
            <div className="space-y-3">
              <p className="text-sm">Admin setup has already been completed.</p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/admin/login">Go to sign in</Link>
              </Button>
            </div>
          )}

          {done && (
            <div className="space-y-3">
              <p className="text-sm">Your ADMIN account is ready.</p>
              <Button asChild className="w-full">
                <Link to="/admin/login">Sign in</Link>
              </Button>
            </div>
          )}

          {available && !done && (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Your email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password (min 12 characters)</Label>
                <Input
                  id="password"
                  type="password"
                  minLength={12}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Creating…" : "Create first ADMIN"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
