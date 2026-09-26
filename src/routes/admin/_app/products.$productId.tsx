import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { setProductConfigureCtaImage, setProductImage, setProductLandingImage, setProductStatus } from "@/lib/catalog.functions";
import { recordAdminAction } from "@/lib/admin-audit";
import {
  MASTER_LANGUAGE,
  PRODUCT_MEDIA_BUCKET,
  PRODUCT_STATUSES,
  productConfigureCtaImagePath,
  productLandingImagePath,
  productImagePath,
  validateBundle,
  type ProductBundle,
} from "@/lib/catalog";
import { fetchProductBundle } from "@/lib/catalog-fetch";
import { ComponentsTab } from "@/components/admin/configurator/ComponentsTab";
import { ConfiguratorTab } from "@/components/admin/configurator/ConfiguratorTab";
import { DependenciesTab } from "@/components/admin/configurator/DependenciesTab";
import { PreviewTab } from "@/components/admin/configurator/PreviewTab";
import { PricingTab } from "@/components/admin/pricing/PricingTab";
import { selectClass } from "@/components/admin/configurator/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/_app/products/$productId")({
  component: ProductEditor,
});

function ProductEditor() {
  const { productId } = Route.useParams();
  const { adminSession } = Route.useRouteContext();
  const canEdit = adminSession.isAdmin;

  const bundleQuery = useQuery({
    queryKey: ["product-bundle", productId],
    queryFn: () => fetchProductBundle(productId),
  });

  if (bundleQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (bundleQuery.error || !bundleQuery.data) {
    return <p className="text-sm text-destructive">This product could not be loaded.</p>;
  }

  const bundle = bundleQuery.data;
  const issues = validateBundle(bundle);
  const errors = issues.filter((i) => i.level === "error");
  const reload = () => void bundleQuery.refetch();

  return (
    <div>
      <PageHeader
        breadcrumb={["Products"]}
        title={bundle.product.internal_name}
        description={`${bundle.product.kind} · ${bundle.product.status}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={errors.length === 0 ? "default" : "destructive"}>
              {errors.length === 0 ? "Ready" : `${errors.length} problem(s)`}
            </Badge>
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/products">Back</Link>
            </Button>
          </div>
        }
      />

      {!canEdit && (
        <p className="mb-4 text-sm text-muted-foreground">
          You are signed in as STAFF: product configuration is read-only.
        </p>
      )}

      <Tabs defaultValue="details">
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="configurator">Configurator</TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="details">
            <DetailsTab bundle={bundle} canEdit={canEdit} reload={reload} />
          </TabsContent>
          <TabsContent value="content">
            <ContentTab bundle={bundle} canEdit={canEdit} reload={reload} />
          </TabsContent>
          <TabsContent value="components">
            <ComponentsTab bundle={bundle} canEdit={canEdit} reload={reload} />
          </TabsContent>
          <TabsContent value="configurator">
            <ConfiguratorTab bundle={bundle} canEdit={canEdit} reload={reload} />
          </TabsContent>
          <TabsContent value="dependencies">
            <DependenciesTab bundle={bundle} canEdit={canEdit} reload={reload} />
          </TabsContent>
          <TabsContent value="pricing">
            <PricingTab bundle={bundle} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="preview">
            <PreviewTab bundle={bundle} />
          </TabsContent>
          <TabsContent value="status">
            <StatusTab bundle={bundle} canEdit={canEdit} reload={reload} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

type TabProps = { bundle: ProductBundle; canEdit: boolean; reload: () => void };

function PackageImageEditor({
  productId,
  imagePath,
  title,
  canEdit,
  reload,
  slot,
}: {
  productId: string;
  imagePath: string | null;
  title: string;
  canEdit: boolean;
  reload: () => void;
  slot: "cover" | "landing" | "cta";
}) {
  const saveCover = useServerFn(setProductImage);
  const saveLanding = useServerFn(setProductLandingImage);
  const saveCta = useServerFn(setProductConfigureCtaImage);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const copy =
    slot === "landing"
      ? {
          label: "Intermediate page image",
          hint: "Shown on the product page before configuration. If empty, the package image is used.",
        }
      : slot === "cta"
        ? {
            label: "Configure button photo",
            hint: "Optional. Fills the Configure this trip button. If empty, the button stays plain.",
          }
        : {
            label: "Package image",
            hint: "Shown on listing cards and in the configurator.",
          };

  const preview = useQuery({
    queryKey: ["product-image", slot, productId, imagePath],
    enabled: Boolean(imagePath),
    queryFn: async () => {
      const { data } = await supabase.storage
        .from(PRODUCT_MEDIA_BUCKET)
        .createSignedUrl(imagePath!, 3600);
      return data?.signedUrl ?? null;
    },
  });

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setUploading(true);
    try {
      const path =
        slot === "landing"
          ? productLandingImagePath(productId, file.name)
          : slot === "cta"
            ? productConfigureCtaImagePath(productId, file.name)
            : productImagePath(productId, file.name);
      const { error } = await supabase.storage.from(PRODUCT_MEDIA_BUCKET).upload(path, file);
      if (error) throw new Error(error.message);
      if (slot === "landing") await saveLanding({ data: { productId, landing_image_path: path } });
      else if (slot === "cta") await saveCta({ data: { productId, configure_cta_image_path: path } });
      else await saveCover({ data: { productId, image_path: path } });
      toast.success("Image saved.");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The image could not be uploaded.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function remove() {
    setUploading(true);
    try {
      if (slot === "landing") await saveLanding({ data: { productId, landing_image_path: null } });
      else if (slot === "cta") await saveCta({ data: { productId, configure_cta_image_path: null } });
      else await saveCover({ data: { productId, image_path: null } });
      toast.success("Image removed.");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The image could not be removed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">{copy.label}</Label>
      <p className="text-xs text-muted-foreground">{copy.hint}</p>
      {imagePath ? (
        preview.data ? (
          <img
            src={preview.data}
            alt={title}
            className="h-40 w-full max-w-sm rounded-md border object-cover"
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            {preview.isPending ? "Loading preview…" : "Preview unavailable."}
          </p>
        )
      ) : (
        <p className="text-xs text-muted-foreground">No image yet.</p>
      )}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void upload(e.target.files)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {uploading ? "Uploading…" : imagePath ? "Replace image" : "Upload image"}
          </Button>
          {imagePath && (
            <Button size="sm" variant="ghost" disabled={uploading} onClick={() => void remove()}>
              Remove image
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function DetailsTab({ bundle, canEdit, reload }: TabProps) {
  const [draft, setDraft] = useState({
    internal_name: bundle.product.internal_name,
    internal_ref: bundle.product.internal_ref ?? "",
    kind: bundle.product.kind as string,
    sort_order: String(bundle.product.sort_order),
  });

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, is_active")
        .order("display_order");
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const placements = useQuery({
    queryKey: ["placements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("placements")
        .select("id, name, is_active")
        .order("display_order");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  async function save() {
    const { error } = await supabase
      .from("products")
      .update({
        internal_name: draft.internal_name.trim(),
        internal_ref: draft.internal_ref.trim() || null,
        kind: draft.kind as never,
        sort_order: Number(draft.sort_order || 0),
      })
      .eq("id", bundle.product.id);
    if (error) { toast.error(error.message); return; }
    await recordAdminAction("product_updated", "products", draft.internal_name);
    toast.success("Product saved.");
    reload();
  }

  async function toggleCategory(categoryId: string, on: boolean) {
    const q = on
      ? supabase.from("product_categories").insert({ product_id: bundle.product.id, category_id: categoryId })
      : supabase
          .from("product_categories")
          .delete()
          .eq("product_id", bundle.product.id)
          .eq("category_id", categoryId);
    const { error } = await q;
    if (error) { toast.error(error.message); return; }
    reload();
  }

  async function togglePlacement(placementId: string, on: boolean) {
    const q = on
      ? supabase.from("product_placements").insert({
          product_id: bundle.product.id,
          placement_id: placementId,
          display_order: bundle.placements.length,
        })
      : supabase
          .from("product_placements")
          .delete()
          .eq("product_id", bundle.product.id)
          .eq("placement_id", placementId);
    const { error } = await q;
    if (error) { toast.error(error.message); return; }
    reload();
  }

  async function setPlacementOrder(placementId: string, order: string) {
    const { error } = await supabase
      .from("product_placements")
      .update({ display_order: Number(order || 0) })
      .eq("product_id", bundle.product.id)
      .eq("placement_id", placementId);
    if (error) { toast.error(error.message); return; }
    reload();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Internal name</Label>
          <Input
            value={draft.internal_name}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, internal_name: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Internal reference</Label>
          <Input
            value={draft.internal_ref}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, internal_ref: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Kind</Label>
          <select
            className={selectClass}
            value={draft.kind}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
          >
            <option value="package">package</option>
            <option value="insurance">insurance</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">Sort order</Label>
          <Input
            value={draft.sort_order}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })}
          />
        </div>
      </div>
      {canEdit && (
        <Button size="sm" onClick={save}>
          Save details
        </Button>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium">Categories</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {(categories.data ?? []).map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={bundle.categoryIds.includes(c.id)}
                disabled={!canEdit}
                onCheckedChange={(v) => toggleCategory(c.id, v === true)}
              />
              {c.name}
              {!c.is_active && <span className="text-xs text-muted-foreground">(inactive)</span>}
            </label>
          ))}
          {(categories.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              No category yet — create one in Categories &amp; Placements.
            </p>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Website placements</h3>
        <div className="space-y-2">
          {(placements.data ?? []).map((p) => {
            const row = bundle.placements.find((x) => x.placement_id === p.id);
            return (
              <div key={p.id} className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={!!row}
                  disabled={!canEdit}
                  onCheckedChange={(v) => togglePlacement(p.id, v === true)}
                />
                <span className="min-w-[10rem]">{p.name}</span>
                {row && (
                  <Input
                    className="h-8 w-20"
                    defaultValue={String(row.display_order)}
                    disabled={!canEdit}
                    onBlur={(e) => setPlacementOrder(p.id, e.target.value)}
                  />
                )}
              </div>
            );
          })}
          {(placements.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              No placement yet — create one in Categories &amp; Placements.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ContentTab({ bundle, canEdit, reload }: TabProps) {
  const t = bundle.translation;
  const [draft, setDraft] = useState({
    title: t?.title ?? "",
    summary: t?.summary ?? "",
    body: t?.body ?? "",
    seo_title: t?.seo_title ?? "",
    seo_description: t?.seo_description ?? "",
  });

  async function save() {
    const payload = {
      product_id: bundle.product.id,
      language_code: MASTER_LANGUAGE,
      title: draft.title.trim() || null,
      summary: draft.summary.trim() || null,
      body: draft.body.trim() || null,
      seo_title: draft.seo_title.trim() || null,
      seo_description: draft.seo_description.trim() || null,
    };
    const { error } = t
      ? await supabase.from("product_translations").update(payload).eq("id", t.id)
      : await supabase.from("product_translations").insert(payload);
    if (error) { toast.error(error.message); return; }
    await recordAdminAction("product_content_updated", "product_translations", bundle.product.internal_name, {
      language: MASTER_LANGUAGE,
    });
    toast.success("Content saved.");
    reload();
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        English is the master language. Other languages come with the translation phase.
      </p>
      <PackageImageEditor
        productId={bundle.product.id}
        imagePath={bundle.product.image_path}
        title={draft.title || bundle.product.internal_name}
        canEdit={canEdit}
        reload={reload}
        slot="cover"
      />
      <PackageImageEditor
        productId={bundle.product.id}
        imagePath={bundle.product.landing_image_path ?? null}
        title={draft.title || bundle.product.internal_name}
        canEdit={canEdit}
        reload={reload}
        slot="landing"
      />
      <PackageImageEditor
        productId={bundle.product.id}
        imagePath={bundle.product.configure_cta_image_path ?? null}
        title={draft.title || bundle.product.internal_name}
        canEdit={canEdit}
        reload={reload}
        slot="cta"
      />
      <div>
        <Label className="text-xs">Title</Label>
        <Input
          value={draft.title}
          disabled={!canEdit}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-xs">Short summary</Label>
        <Textarea
          rows={2}
          value={draft.summary}
          disabled={!canEdit}
          onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-xs">Description</Label>
        <Textarea
          rows={8}
          value={draft.body}
          disabled={!canEdit}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">SEO title</Label>
          <Input
            value={draft.seo_title}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, seo_title: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">SEO description</Label>
          <Input
            value={draft.seo_description}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, seo_description: e.target.value })}
          />
        </div>
      </div>
      {canEdit && (
        <Button size="sm" onClick={save}>
          Save content
        </Button>
      )}
    </div>
  );
}

function StatusTab({ bundle, canEdit, reload }: TabProps) {
  const issues = validateBundle(bundle);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const change = useServerFn(setProductStatus);
  const [busy, setBusy] = useState(false);

  async function apply(status: string) {
    setBusy(true);
    try {
      await change({
        data: {
          productId: bundle.product.id,
          status: status as (typeof PRODUCT_STATUSES)[number],
          errorCount: errors.length,
        },
      });
      toast.success(`Status set to ${status}.`);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The status could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm">
          Current status: <span className="font-medium">{bundle.product.status}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Active means published and available. Inactive and draft products stay visible to
          administrators only.
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">
          {errors.length === 0 ? "No structural problem" : `${errors.length} problem(s) to fix`}
        </h3>
        <ul className="space-y-1 text-sm">
          {errors.map((i, n) => (
            <li key={`e${n}`} className="text-destructive">
              • {i.message}
            </li>
          ))}
          {warnings.map((i, n) => (
            <li key={`w${n}`} className="text-muted-foreground">
              • {i.message}
            </li>
          ))}
        </ul>
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {PRODUCT_STATUSES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={bundle.product.status === s ? "default" : "outline"}
              disabled={busy || bundle.product.status === s || (s === "active" && errors.length > 0)}
              onClick={() => apply(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
