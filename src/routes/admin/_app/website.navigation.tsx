import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { deleteNavItem, reorderNavItems, saveNavItem } from "@/lib/website.functions";
import {
  DESTINATION_KINDS,
  DESTINATION_LABELS,
  WEBSITE_MEDIA_BUCKET,
  moveInOrder,
  type DestinationKind,
} from "@/lib/website";
import {
  LanguagePicker,
  useWebsiteLanguages,
  useWebsitePageOptions,
  useWebsiteProducts,
} from "@/components/admin/website/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/_app/website/navigation")({
  component: WebsiteNavigationScreen,
});

type NavRow = {
  id: string;
  internal_name: string;
  destination_kind: DestinationKind;
  destination_page_id: string | null;
  destination_product_id: string | null;
  destination_external_url: string | null;
  is_active: boolean;
  image_path: string | null;
  sort_order: number;
};

type Draft = {
  id?: string;
  internal_name: string;
  destination_kind: DestinationKind;
  destination_page_id: string | null;
  destination_product_id: string | null;
  destination_external_url: string;
  is_active: boolean;
  image_path: string | null;
  label: string;
};

const selectClass = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm";

function WebsiteNavigationScreen() {
  const { adminSession } = Route.useRouteContext();
  const canEdit = adminSession.isAdmin;
  const queryClient = useQueryClient();

  const languages = useWebsiteLanguages();
  const [language, setLanguage] = useState("");
  const activeLanguage = language || languages.master;

  const pageOptions = useWebsitePageOptions();
  const products = useWebsiteProducts();

  const persist = useServerFn(saveNavItem);
  const remove = useServerFn(deleteNavItem);
  const reorder = useServerFn(reorderNavItems);

  const items = useQuery({
    queryKey: ["website-nav-items"],
    queryFn: async () => {
      const columns =
        "id, internal_name, destination_kind, destination_page_id, destination_product_id, destination_external_url, is_active, sort_order";
      const { data, error } = await supabase.from("website_nav_items").select(columns).order("sort_order");
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Omit<NavRow, "image_path">[];
      const ids = rows.map((row) => row.id);
      const imageById = new Map<string, string | null>();
      if (ids.length > 0) {
        const images = await supabase.from("website_nav_items").select("id, image_path").in("id", ids);
        if (!images.error) {
          for (const row of images.data ?? []) {
            imageById.set(row.id as string, (row.image_path as string | null) ?? null);
          }
        }
      }
      return rows.map((row) => ({
        ...row,
        image_path: imageById.get(row.id) ?? null,
      })) as NavRow[];
    },
  });

  const labels = useQuery({
    queryKey: ["website-nav-labels", activeLanguage],
    enabled: Boolean(activeLanguage),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_nav_item_translations")
        .select("nav_item_id, label")
        .eq("language_code", activeLanguage);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const [draft, setDraft] = useState<Draft | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function sign(path: string | null) {
      if (!path) return null;
      const { data } = await supabase.storage.from(WEBSITE_MEDIA_BUCKET).createSignedUrl(path, 3600);
      return data?.signedUrl ?? null;
    }
    void (async () => {
      const url = await sign(draft?.image_path ?? null);
      if (!cancelled) setImagePreview(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [draft?.image_path]);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["website-nav-items"] });
    void queryClient.invalidateQueries({ queryKey: ["website-nav-labels"] });
  }

  async function submit() {
    if (!draft) return;
    try {
      await persist({
        data: {
          id: draft.id,
          internal_name: draft.internal_name,
          destination_kind: draft.destination_kind,
          destination_page_id: draft.destination_page_id,
          destination_product_id: draft.destination_product_id,
          destination_external_url: draft.destination_external_url,
          is_active: draft.is_active,
          image_path: draft.image_path,
          language: activeLanguage,
          label: draft.label,
        },
      });
      toast.success("Menu item saved.");
      setDraft(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This menu item could not be saved.");
    }
  }

  async function toggle(item: NavRow, isActive: boolean) {
    const label = (labels.data ?? []).find((l: any) => l.nav_item_id === item.id)?.label ?? null;
    try {
      await persist({
        data: {
          id: item.id,
          internal_name: item.internal_name,
          destination_kind: item.destination_kind,
          destination_page_id: item.destination_page_id,
          destination_product_id: item.destination_product_id,
          destination_external_url: item.destination_external_url,
          is_active: isActive,
          language: activeLanguage,
          label,
        },
      });
      refresh();
    } catch {
      toast.error("This menu item could not be changed.");
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const rows = items.data ?? [];
    const next = moveInOrder(rows, index, direction);
    if (next === rows) return;
    try {
      await reorder({ data: { orderedIds: next.map((i) => i.id) } });
      refresh();
    } catch {
      toast.error("The menu could not be reordered.");
    }
  }

  async function destroy(item: NavRow) {
    if (!window.confirm(`Remove the menu item "${item.internal_name}"?`)) return;
    try {
      await remove({ data: { id: item.id } });
      toast.success("Menu item removed.");
      refresh();
    } catch {
      toast.error("This menu item could not be removed.");
    }
  }

  async function uploadImage(files: FileList | null) {
    const file = files?.[0];
    if (!file || !draft?.id) return;
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `nav/${draft.id}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from(WEBSITE_MEDIA_BUCKET).upload(path, file);
      if (error) throw new Error(error.message);
      setDraft({ ...draft, image_path: path });
      toast.success("Uploaded. Save to keep it.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This file could not be uploaded.");
    } finally {
      setUploading(false);
      if (imageInput.current) imageInput.current.value = "";
    }
  }

  return (
    <>
      <PageHeader
        title="Website navigation"
        description="The menu shown on the public website: labels, destinations and order."
        breadcrumb={["Admin", "Website", "Navigation"]}
        actions={
          canEdit && (
            <Button
              size="sm"
              onClick={() =>
                setDraft({
                  internal_name: "",
                  destination_kind: "page",
                  destination_page_id: null,
                  destination_product_id: null,
                  destination_external_url: "",
                  is_active: true,
                  image_path: null,
                  label: "",
                })
              }
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New menu item
            </Button>
          )
        }
      />

      <div className="mb-4">
        <LanguagePicker value={activeLanguage} onChange={setLanguage} languages={languages.list} />
      </div>

      {draft && (
        <Card className="mb-4">
          <CardContent className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="nav-name">Internal name</Label>
                <Input
                  id="nav-name"
                  value={draft.internal_name}
                  onChange={(e) => setDraft({ ...draft, internal_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="nav-label">Menu label ({activeLanguage})</Label>
                <Input
                  id="nav-label"
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="nav-kind">Goes to</Label>
                <select
                  id="nav-kind"
                  className={selectClass}
                  value={draft.destination_kind}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      destination_kind: e.target.value as DestinationKind,
                      destination_page_id: null,
                      destination_product_id: null,
                      destination_external_url: "",
                    })
                  }
                >
                  {DESTINATION_KINDS.filter((k) => k !== "none").map((kind) => (
                    <option key={kind} value={kind}>
                      {DESTINATION_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </div>

              {draft.destination_kind === "page" && (
                <div>
                  <Label htmlFor="nav-page">Page</Label>
                  <select
                    id="nav-page"
                    className={selectClass}
                    value={draft.destination_page_id ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, destination_page_id: e.target.value || null })
                    }
                  >
                    <option value="">Choose a page…</option>
                    {(pageOptions.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.internal_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {draft.destination_kind === "product" && (
                <div>
                  <Label htmlFor="nav-product">Product</Label>
                  <select
                    id="nav-product"
                    className={selectClass}
                    value={draft.destination_product_id ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, destination_product_id: e.target.value || null })
                    }
                  >
                    <option value="">Choose a product…</option>
                    {(products.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.internal_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {draft.destination_kind === "external" && (
                <div>
                  <Label htmlFor="nav-url">Link (https://…)</Label>
                  <Input
                    id="nav-url"
                    value={draft.destination_external_url}
                    onChange={(e) => setDraft({ ...draft, destination_external_url: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="nav-active"
                checked={draft.is_active}
                onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
              />
              <Label htmlFor="nav-active">Shown in the menu</Label>
            </div>

            <div className="space-y-2">
              <Label>Menu image (optional)</Label>
              <p className="text-xs text-muted-foreground">
                Shown in the public header. Independent of the destination page image.
              </p>
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt=""
                  className="h-28 w-full max-w-sm object-cover"
                />
              )}
              {draft.id ? (
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={imageInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void uploadImage(e.target.files)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => imageInput.current?.click()}
                  >
                    {draft.image_path ? "Replace image" : "Upload image"}
                  </Button>
                  {draft.image_path && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setDraft({ ...draft, image_path: null })}
                    >
                      Remove image
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Save the menu item first, then you can add an image.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={() => void submit()}>
                Save menu item
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {items.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {items.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No menu items configured yet.</p>
        )}
        {(items.data ?? []).map((item, index) => {
          const label = (labels.data ?? []).find((l: any) => l.nav_item_id === item.id)?.label ?? null;
          return (
            <Card key={item.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{label ?? item.internal_name}</p>
                    {!item.is_active && <Badge variant="secondary">Hidden</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {DESTINATION_LABELS[item.destination_kind]}
                    {item.destination_external_url ? ` · ${item.destination_external_url}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={!canEdit || index === 0}
                    aria-label="Move up"
                    onClick={() => void move(index, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={!canEdit || index === (items.data?.length ?? 0) - 1}
                    aria-label="Move down"
                    onClick={() => void move(index, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Switch
                    checked={item.is_active}
                    disabled={!canEdit}
                    aria-label="Shown in the menu"
                    onCheckedChange={(v) => void toggle(item, v)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() =>
                      setDraft({
                        id: item.id,
                        internal_name: item.internal_name,
                        destination_kind: item.destination_kind,
                        destination_page_id: item.destination_page_id,
                        destination_product_id: item.destination_product_id,
                        destination_external_url: item.destination_external_url ?? "",
                        is_active: item.is_active,
                        image_path: item.image_path,
                        label: label ?? "",
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={!canEdit}
                    aria-label="Remove menu item"
                    onClick={() => void destroy(item)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
