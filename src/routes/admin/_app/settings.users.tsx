import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/AdminLayout";
import { createAdminUser, grantRole, listAdminUsers, revokeRole } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/_app/settings/users")({
  beforeLoad: ({ context }) => {
    if (!(context as { adminSession?: { isAdmin: boolean } }).adminSession?.isAdmin) {
      throw redirect({ to: "/admin" });
    }
  },
  component: UsersPage,
});

function UsersPage() {
  const queryClient = useQueryClient();
  const fetchUsers = useServerFn(listAdminUsers);
  const create = useServerFn(createAdminUser);
  const grant = useServerFn(grantRole);
  const revoke = useServerFn(revokeRole);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", role: "STAFF" as "ADMIN" | "STAFF" });

  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers() });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    queryClient.invalidateQueries({ queryKey: ["audit-log"] });
  }

  const createUser = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: () => {
      toast.success("Account created");
      setOpen(false);
      setForm({ email: "", password: "", role: "STAFF" });
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create the account."),
  });

  const grantMutation = useMutation({
    mutationFn: (vars: { userId: string; role: "ADMIN" | "STAFF" }) => grant({ data: vars }),
    onSuccess: () => {
      toast.success("Role granted");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not grant the role."),
  });

  const revokeMutation = useMutation({
    mutationFn: (vars: { userId: string; role: "ADMIN" | "STAFF" }) => revoke({ data: vars }),
    onSuccess: () => {
      toast.success("Role removed");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove the role."),
  });

  return (
    <>
      <PageHeader
        title="Users & roles"
        description="Admin and Staff accounts. Customers never have accounts."
        breadcrumb={["Admin", "Settings", "Users & roles"]}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Add account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Admin or Staff account</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Temporary password (min 12 characters)</Label>
                  <Input
                    id="password"
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select
                    value={form.role}
                    onValueChange={(v) => setForm({ ...form, role: v as "ADMIN" | "STAFF" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STAFF">STAFF</SelectItem>
                      <SelectItem value="ADMIN">ADMIN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createUser.mutate()} disabled={createUser.isPending}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead>Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="text-sm">{user.email}</TableCell>
                  <TableCell className="space-x-1">
                    {user.roles.length === 0 && (
                      <span className="text-xs text-muted-foreground">No role</span>
                    )}
                    {user.roles.map((role) => (
                      <Badge key={role} variant="secondary">
                        {role}
                      </Badge>
                    ))}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {user.last_sign_in_at
                      ? new Date(user.last_sign_in_at).toLocaleString("en-GB", { timeZone: "UTC" })
                      : "Never"}
                  </TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap">
                    {(["ADMIN", "STAFF"] as const).map((role) =>
                      user.roles.includes(role) ? (
                        <AlertDialog key={role}>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              Remove {role}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove the {role} role?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {user.email} will immediately lose {role} access to the Admin
                                application.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  revokeMutation.mutate({ userId: user.id, role })
                                }
                              >
                                Remove role
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <Button
                          key={role}
                          size="sm"
                          variant="ghost"
                          onClick={() => grantMutation.mutate({ userId: user.id, role })}
                        >
                          Grant {role}
                        </Button>
                      ),
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
