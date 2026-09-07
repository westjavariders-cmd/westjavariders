import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { recordAdminAction } from "@/lib/admin-audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/_app/catalog-taxonomy")({
  component: TaxonomyPage,
});

type Row = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
};

function TaxonomyPage() {
  const { adminSession } = Route.useRouteContext();
  const canEdit = adminSession.isAdmin;

  return (
    <div>
      <PageHeader
        breadcrumb={["Products"]}
        title="Categories & Placements"
        description="Reusable groupings and the website positions products can appear in."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <TaxonomyList table="categories" title="Categories" canEdit={canEdit} />
        <TaxonomyList table="placements" title="Placements" canEdit={canEdit} />
      </div>
    </div>
  );
}

function TaxonomyList({
  table,
  title,
  canEdit,
}: {
  table: "categories" | "placements";
  title: string;
  canEdit: boolean;
}) {
  const [newRow, setNewRow] = useState({ slug: "", name: "" });

  const list = useQuery({
    queryKey: [table],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select("id, slug, name, description, display_order, is_active")
        .order("display_order");
      if (error) throw new Error(error.message);
      return data as Row[];
    },
  });

  async function add() {
    const slug = newRow.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      { toast.error("Use lowercase letters, numbers and hyphens for the slug."); return; }
    }
    if (!newRow.name.trim()) { toast.error("A name is required."); return; }
    const { error } = await supabase.from(table).insert({
      slug,
      name: newRow.name.trim(),
      display_order: (list.data ?? []).length,
    });
    if (error) { toast.error(error.message); return; }
    await recordAdminAction(`${table}_created`, table, slug);
    setNewRow({ slug: "", name: "" });
    list.refetch();
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <h2 className="text-sm font-medium">{title}</h2>

        {canEdit && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-[11px]">Slug</Label>
              <Input
                className="h-8 w-32 font-mono text-xs"
                value={newRow.slug}
                onChange={(e) => setNewRow({ ...newRow, slug: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-[11px]">Name</Label>
              <Input
                className="h-8 w-40 text-xs"
                value={newRow.name}
                onChange={(e) => setNewRow({ ...newRow, name: e.target.value })}
              />
            </div>
            <Button size="sm" onClick={add}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        )}

        {(list.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        )}

        <div className="space-y-2">
          {(list.data ?? []).map((row) => (
            <TaxonomyRow
              key={row.id}
              table={table}
              row={row}
              canEdit={canEdit}
              reload={() => list.refetch()}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TaxonomyRow({
  table,
  row,
  canEdit,
  reload,
}: {
  table: "categories" | "placements";
  row: Row;
  canEdit: boolean;
  reload: () => void;
}) {
  const [draft, setDraft] = useState({
    name: row.name,
    description: row.description ?? "",
    display_order: String(row.display_order),
    is_active: row.is_active,
  });

  async function save() {
    const { error } = await supabase
      .from(table)
      .update({
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        display_order: Number(draft.display_order || 0),
        is_active: draft.is_active,
      })
      .eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    await recordAdminAction(`${table}_updated`, table, row.slug);
    toast.success("Saved.");
    reload();
  }

  async function remove() {
    const { error } = await supabase.from(table).delete().eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    await recordAdminAction(`${table}_deleted`, table, row.slug);
    reload();
  }

  return (
    <div className="grid items-end gap-2 rounded-md bg-muted/40 p-2 sm:grid-cols-[1fr_4rem_auto]">
      <div>
        <Label className="text-[11px] font-mono">{row.slug}</Label>
        <Input
          className="h-8 text-xs"
          value={draft.name}
          disabled={!canEdit}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-[11px]">Order</Label>
        <Input
          className="h-8 text-xs"
          value={draft.display_order}
          disabled={!canEdit}
          onChange={(e) => setDraft({ ...draft, display_order: e.target.value })}
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-[11px]">
          <Switch
            checked={draft.is_active}
            disabled={!canEdit}
            onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
          />
          Active
        </label>
        {canEdit && (
          <>
            <Button size="sm" variant="outline" onClick={save}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={remove}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
