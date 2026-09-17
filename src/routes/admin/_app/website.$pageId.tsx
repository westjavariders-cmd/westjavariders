import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2, Upload } from "lucide-react";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteBlock,
  deleteSection,
  reorderBlocks,
  reorderSections,
  saveBlock,
  saveSection,
  translateWebsitePage,
} from "@/lib/website.functions";

import {
  BLOCK_KINDS,
  BLOCK_KIND_LABELS,
  DESTINATION_KINDS,
  DESTINATION_LABELS,
  WEBSITE_MEDIA_BUCKET,
  moveInOrder,
  type BlockKind,
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/_app/website/$pageId")({
  component: WebsitePageEditor,
});

type SectionRow = { id: string; internal_name: string; is_active: boolean; sort_order: number };
type BlockRow = {
  id: string;
  section_id: string;
  block_kind: BlockKind;
  internal_name: string;
  is_active: boolean;
  sort_order: number;
  media_kind: "image" | "video" | null;
  media_path: string | null;
  cta_kind: DestinationKind;
  cta_page_id: string | null;
  cta_product_id: string | null;
  cta_external_url: string | null;
};

type BlockDraft = {
  id?: string;
  section_id: string;
  block_kind: BlockKind;
  internal_name: string;
  is_active: boolean;
  media_kind: "image" | "video" | null;
  media_path: string | null;
  cta_kind: DestinationKind;
  cta_page_id: string | null;
  cta_product_id: string | null;
  cta_external_url: string;
  title: string;
  body: string;
  cta_label: string;
  product_ids: string[];
  catalogue_ids: string[];
};

function selectClass() {
  return "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm";
}

function WebsitePageEditor() {
  const { pageId } = Route.useParams();
  const { adminSession } = Route.useRouteContext();
  const canEdit = adminSession.isAdmin;
  const queryClient = useQueryClient();

  const languages = useWebsiteLanguages();
  const [language, setLanguage] = useState("");
  const activeLanguage = language || languages.master;

  const products = useWebsiteProducts();
  const pageOptions = useWebsitePageOptions();

  const persistSection = useServerFn(saveSection);
  const removeSection = useServerFn(deleteSection);
  const orderSections = useServerFn(reorderSections);
  const persistBlock = useServerFn(saveBlock);
  const removeBlock = useServerFn(deleteBlock);
  const orderBlocks = useServerFn(reorderBlocks);
  const runTranslation = useServerFn(translateWebsitePage);
  const [translating, setTranslating] = useState(false);


  const page = useQuery({
    queryKey: ["website-page", pageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_pages")
        .select("id, slug, internal_name, is_active")
        .eq("id", pageId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const sections = useQuery({
    queryKey: ["website-sections", pageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_sections")
        .select("id, internal_name, is_active, sort_order")
        .eq("page_id", pageId)
        .order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []) as SectionRow[];
    },
  });

  const sectionIds = (sections.data ?? []).map((s) => s.id);

  const sectionText = useQuery({
    queryKey: ["website-section-text", pageId, activeLanguage, sectionIds.join(",")],
    enabled: sectionIds.length > 0 && Boolean(activeLanguage),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_section_translations")
        .select("section_id, title, subtitle")
        .in("section_id", sectionIds)
        .eq("language_code", activeLanguage);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const blocks = useQuery({
    queryKey: ["website-blocks", pageId, sectionIds.join(",")],
    enabled: sectionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_blocks")
        .select(
          "id, section_id, block_kind, internal_name, is_active, sort_order, media_kind, media_path, cta_kind, cta_page_id, cta_product_id, cta_external_url",
        )
        .in("section_id", sectionIds)
        .order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []) as BlockRow[];
    },
  });

  const blockIds = (blocks.data ?? []).map((b) => b.id);

  const blockText = useQuery({
    queryKey: ["website-block-text", activeLanguage, blockIds.join(",")],
    enabled: blockIds.length > 0 && Boolean(activeLanguage),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_block_translations")
        .select("block_id, title, body, cta_label")
        .in("block_id", blockIds)
        .eq("language_code", activeLanguage);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const blockProducts = useQuery({
    queryKey: ["website-block-products", blockIds.join(",")],
    enabled: blockIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_block_products")
        .select("block_id, product_id, sort_order")
        .in("block_id", blockIds)
        .order("sort_order");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const blockCatalogues = useQuery({
    queryKey: ["website-block-catalogues", blockIds.join(",")],
    enabled: blockIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_block_catalogues")
        .select("block_id, catalogue_id, sort_order")
        .in("block_id", blockIds)
        .order("sort_order");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const catalogues = useQuery({
    queryKey: ["website-catalogue-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogues")
        .select("id, internal_name, public_name, template, active")
        .eq("active", true)
        .order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []) as {
        id: string;
        internal_name: string;
        public_name: string | null;
        template: string;
      }[];
    },
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["website-sections", pageId] });
    void queryClient.invalidateQueries({ queryKey: ["website-section-text"] });
    void queryClient.invalidateQueries({ queryKey: ["website-blocks", pageId] });
    void queryClient.invalidateQueries({ queryKey: ["website-block-text"] });
    void queryClient.invalidateQueries({ queryKey: ["website-block-products"] });
    void queryClient.invalidateQueries({ queryKey: ["website-block-catalogues"] });
  }

  async function translatePage(overwrite: boolean) {
    setTranslating(true);
    try {
      const result = await runTranslation({
        data: { page_id: pageId, language: activeLanguage, overwrite },
      });
      if (result.translated === 0) {
        toast.success("Nothing left to translate on this page.");
      } else {
        toast.success(`Translated ${result.translated} texts into ${activeLanguage}.`);
      }
      void queryClient.invalidateQueries({ queryKey: ["website-page-translations"] });
      refresh();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "The texts could not be translated.",
      );
    } finally {
      setTranslating(false);
    }
  }


  /* ---------------- sections ---------------- */

  const [sectionDraft, setSectionDraft] = useState<{
    id?: string;
    internal_name: string;
    is_active: boolean;
    title: string;
    subtitle: string;
  } | null>(null);

  async function submitSection() {
    if (!sectionDraft) return;
    try {
      await persistSection({
        data: {
          id: sectionDraft.id,
          page_id: pageId,
          internal_name: sectionDraft.internal_name,
          is_active: sectionDraft.is_active,
          language: activeLanguage,
          title: sectionDraft.title,
          subtitle: sectionDraft.subtitle,
        },
      });
      toast.success("Section saved.");
      setSectionDraft(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This section could not be saved.");
    }
  }

  async function toggleSection(section: SectionRow, isActive: boolean) {
    const text = (sectionText.data ?? []).find((t: any) => t.section_id === section.id);
    try {
      await persistSection({
        data: {
          id: section.id,
          page_id: pageId,
          internal_name: section.internal_name,
          is_active: isActive,
          language: activeLanguage,
          title: text?.title ?? null,
          subtitle: text?.subtitle ?? null,
        },
      });
      refresh();
    } catch {
      toast.error("This section could not be changed.");
    }
  }

  async function moveSection(index: number, direction: -1 | 1) {
    const rows = sections.data ?? [];
    const next = moveInOrder(rows, index, direction);
    if (next === rows) return;
    try {
      await orderSections({ data: { orderedIds: next.map((s) => s.id) } });
      refresh();
    } catch {
      toast.error("The sections could not be reordered.");
    }
  }

  async function destroySection(section: SectionRow) {
    if (!window.confirm(`Remove the section "${section.internal_name}" and its blocks?`)) return;
    try {
      await removeSection({ data: { id: section.id } });
      toast.success("Section removed.");
      refresh();
    } catch {
      toast.error("This section could not be removed.");
    }
  }

  /* ---------------- blocks ---------------- */

  const [blockDraft, setBlockDraft] = useState<BlockDraft | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  function newBlock(sectionId: string): BlockDraft {
    return {
      section_id: sectionId,
      block_kind: "text",
      internal_name: "",
      is_active: true,
      media_kind: null,
      media_path: null,
      cta_kind: "none",
      cta_page_id: null,
      cta_product_id: null,
      cta_external_url: "",
      title: "",
      body: "",
      cta_label: "",
      product_ids: [],
      catalogue_ids: [],
    };
  }

  async function openBlock(block: BlockRow) {
    const text = (blockText.data ?? []).find((t: any) => t.block_id === block.id);
    setBlockDraft({
      id: block.id,
      section_id: block.section_id,
      block_kind: block.block_kind,
      internal_name: block.internal_name,
      is_active: block.is_active,
      media_kind: block.media_kind,
      media_path: block.media_path,
      cta_kind: block.cta_kind,
      cta_page_id: block.cta_page_id,
      cta_product_id: block.cta_product_id,
      cta_external_url: block.cta_external_url ?? "",
      title: text?.title ?? "",
      body: text?.body ?? "",
      cta_label: text?.cta_label ?? "",
      product_ids: (blockProducts.data ?? [])
        .filter((r: any) => r.block_id === block.id)
        .map((r: any) => r.product_id),
      catalogue_ids: (blockCatalogues.data ?? [])
        .filter((r: any) => r.block_id === block.id)
        .map((r: any) => r.catalogue_id),
    });
    setMediaPreview(null);
    if (block.media_path) {
      const { data } = await supabase.storage
        .from(WEBSITE_MEDIA_BUCKET)
        .createSignedUrl(block.media_path, 3600);
      setMediaPreview(data?.signedUrl ?? null);
    }
  }

  async function uploadMedia(files: FileList | null) {
    if (!files || files.length === 0 || !blockDraft) return;
    const file = files[0];
    if (!file) return;
    const kind = file.type.startsWith("video/") ? "video" : "image";
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "-");
      const path = `blocks/${crypto.randomUUID()}-${safe}`;
      const { error } = await supabase.storage.from(WEBSITE_MEDIA_BUCKET).upload(path, file);
      if (error) throw new Error(error.message);
      setBlockDraft({ ...blockDraft, media_kind: kind, media_path: path });
      const { data } = await supabase.storage.from(WEBSITE_MEDIA_BUCKET).createSignedUrl(path, 3600);
      setMediaPreview(data?.signedUrl ?? null);
      toast.success("Media uploaded. Save the block to keep it.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This file could not be uploaded.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function submitBlock() {
    if (!blockDraft) return;
    try {
      await persistBlock({
        data: {
          id: blockDraft.id,
          section_id: blockDraft.section_id,
          block_kind: blockDraft.block_kind,
          internal_name: blockDraft.internal_name,
          is_active: blockDraft.is_active,
          media_kind: blockDraft.media_kind,
          media_path: blockDraft.media_path,
          cta_kind: blockDraft.cta_kind,
          cta_page_id: blockDraft.cta_page_id,
          cta_product_id: blockDraft.cta_product_id,
          cta_external_url: blockDraft.cta_external_url,
          language: activeLanguage,
          title: blockDraft.title,
          body: blockDraft.body,
          cta_label: blockDraft.cta_label,
          product_ids: blockDraft.product_ids,
          catalogue_ids: blockDraft.catalogue_ids,
        },
      });
      toast.success("Block saved.");
      setBlockDraft(null);
      setMediaPreview(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This block could not be saved.");
    }
  }

  async function toggleBlock(block: BlockRow, isActive: boolean) {
    const text = (blockText.data ?? []).find((t: any) => t.block_id === block.id);
    try {
      await persistBlock({
        data: {
          id: block.id,
          section_id: block.section_id,
          block_kind: block.block_kind,
          internal_name: block.internal_name,
          is_active: isActive,
          media_kind: block.media_kind,
          media_path: block.media_path,
          cta_kind: block.cta_kind,
          cta_page_id: block.cta_page_id,
          cta_product_id: block.cta_product_id,
          cta_external_url: block.cta_external_url,
          language: activeLanguage,
          title: text?.title ?? null,
          body: text?.body ?? null,
          cta_label: text?.cta_label ?? null,
        },
      });
      refresh();
    } catch {
      toast.error("This block could not be changed.");
    }
  }

  async function moveBlock(sectionId: string, index: number, direction: -1 | 1) {
    const rows = (blocks.data ?? []).filter((b) => b.section_id === sectionId);
    const next = moveInOrder(rows, index, direction);
    if (next === rows) return;
    try {
      await orderBlocks({ data: { orderedIds: next.map((b) => b.id) } });
      refresh();
    } catch {
      toast.error("The blocks could not be reordered.");
    }
  }

  async function destroyBlock(block: BlockRow) {
    if (!window.confirm(`Remove the block "${block.internal_name}"?`)) return;
    try {
      await removeBlock({ data: { id: block.id } });
      toast.success("Block removed.");
      refresh();
    } catch {
      toast.error("This block could not be removed.");
    }
  }

  const showsProducts =
    blockDraft?.block_kind === "product_selection" || blockDraft?.block_kind === "people";

  return (
    <>
      <PageHeader
        title={page.data?.internal_name ?? "Page"}
        description="Sections appear top to bottom. Blocks appear in order inside their section."
        breadcrumb={["Admin", "Website", "Pages", page.data?.internal_name ?? ""]}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/admin/website">All pages</Link>
            </Button>
            {canEdit && (
              <Button
                size="sm"
                onClick={() =>
                  setSectionDraft({ internal_name: "", is_active: true, title: "", subtitle: "" })
                }
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New section
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4">
        <LanguagePicker value={activeLanguage} onChange={setLanguage} languages={languages.list} />
      </div>

      {sectionDraft && (
        <Card className="mb-4">
          <CardContent className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="section-name">Internal name</Label>
                <Input
                  id="section-name"
                  value={sectionDraft.internal_name}
                  onChange={(e) => setSectionDraft({ ...sectionDraft, internal_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="section-title">Displayed title ({activeLanguage})</Label>
                <Input
                  id="section-title"
                  value={sectionDraft.title}
                  onChange={(e) => setSectionDraft({ ...sectionDraft, title: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="section-subtitle">Supporting text ({activeLanguage})</Label>
              <Textarea
                id="section-subtitle"
                rows={2}
                value={sectionDraft.subtitle}
                onChange={(e) => setSectionDraft({ ...sectionDraft, subtitle: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="section-active"
                checked={sectionDraft.is_active}
                onCheckedChange={(v) => setSectionDraft({ ...sectionDraft, is_active: v })}
              />
              <Label htmlFor="section-active">Visible on the website</Label>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void submitSection()}>
                Save section
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSectionDraft(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {blockDraft && (
        <Card className="mb-4 border-primary">
          <CardContent className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="block-name">Internal name</Label>
                <Input
                  id="block-name"
                  value={blockDraft.internal_name}
                  onChange={(e) => setBlockDraft({ ...blockDraft, internal_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="block-kind">Block type</Label>
                <select
                  id="block-kind"
                  className={selectClass()}
                  value={blockDraft.block_kind}
                  onChange={(e) =>
                    setBlockDraft({ ...blockDraft, block_kind: e.target.value as BlockKind })
                  }
                >
                  {BLOCK_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {BLOCK_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="block-title">Title ({activeLanguage})</Label>
                <Input
                  id="block-title"
                  value={blockDraft.title}
                  onChange={(e) => setBlockDraft({ ...blockDraft, title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="block-cta-label">Button text ({activeLanguage})</Label>
                <Input
                  id="block-cta-label"
                  value={blockDraft.cta_label}
                  onChange={(e) => setBlockDraft({ ...blockDraft, cta_label: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="block-body">Text ({activeLanguage})</Label>
              <Textarea
                id="block-body"
                rows={4}
                value={blockDraft.body}
                onChange={(e) => setBlockDraft({ ...blockDraft, body: e.target.value })}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="block-cta-kind">Button goes to</Label>
                <select
                  id="block-cta-kind"
                  className={selectClass()}
                  value={blockDraft.cta_kind}
                  onChange={(e) =>
                    setBlockDraft({
                      ...blockDraft,
                      cta_kind: e.target.value as DestinationKind,
                      cta_page_id: null,
                      cta_product_id: null,
                      cta_external_url: "",
                    })
                  }
                >
                  {DESTINATION_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {DESTINATION_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </div>

              {blockDraft.cta_kind === "page" && (
                <div>
                  <Label htmlFor="block-cta-page">Page</Label>
                  <select
                    id="block-cta-page"
                    className={selectClass()}
                    value={blockDraft.cta_page_id ?? ""}
                    onChange={(e) => setBlockDraft({ ...blockDraft, cta_page_id: e.target.value || null })}
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

              {blockDraft.cta_kind === "product" && (
                <div>
                  <Label htmlFor="block-cta-product">Product</Label>
                  <select
                    id="block-cta-product"
                    className={selectClass()}
                    value={blockDraft.cta_product_id ?? ""}
                    onChange={(e) =>
                      setBlockDraft({ ...blockDraft, cta_product_id: e.target.value || null })
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

              {blockDraft.cta_kind === "external" && (
                <div>
                  <Label htmlFor="block-cta-url">Link (https://…)</Label>
                  <Input
                    id="block-cta-url"
                    value={blockDraft.cta_external_url}
                    onChange={(e) => setBlockDraft({ ...blockDraft, cta_external_url: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Image or video</Label>
              <input
                ref={fileInput}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => void uploadMedia(e.target.files)}
              />
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  {uploading ? "Uploading…" : blockDraft.media_path ? "Replace media" : "Upload media"}
                </Button>
                {blockDraft.media_path && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setBlockDraft({ ...blockDraft, media_kind: null, media_path: null });
                      setMediaPreview(null);
                    }}
                  >
                    Remove media
                  </Button>
                )}
              </div>
              {mediaPreview && blockDraft.media_kind === "image" && (
                <img src={mediaPreview} alt="" className="h-32 w-auto rounded-md border" />
              )}
              {mediaPreview && blockDraft.media_kind === "video" && (
                <video src={mediaPreview} controls className="h-32 w-auto rounded-md border" />
              )}
            </div>

            {blockDraft.block_kind === "catalogue" && (
              <div>
                <Label>Catalogues shown by this block</Label>
                <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                  {(catalogues.data ?? []).map((c) => {
                    const checked = blockDraft.catalogue_ids.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setBlockDraft({
                              ...blockDraft,
                              catalogue_ids: checked
                                ? blockDraft.catalogue_ids.filter((id) => id !== c.id)
                                : [...blockDraft.catalogue_ids, c.id],
                            })
                          }
                        />
                        {c.public_name ?? c.internal_name}
                        <span className="text-muted-foreground">({c.template})</span>
                      </label>
                    );
                  })}
                  {(catalogues.data ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">No active catalogues yet.</p>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Each bookable item links to its own booking page.
                </p>
              </div>
            )}

            {showsProducts && (
              <div>
                <Label>Products shown by this block</Label>
                <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                  {(products.data ?? []).map((p) => {
                    const checked = blockDraft.product_ids.includes(p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setBlockDraft({
                              ...blockDraft,
                              product_ids: checked
                                ? blockDraft.product_ids.filter((id) => id !== p.id)
                                : [...blockDraft.product_ids, p.id],
                            })
                          }
                        />
                        <span>{p.internal_name}</span>
                        {p.status !== "active" && (
                          <Badge variant="secondary" className="text-[10px]">
                            {p.status}
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Names, prices and availability always come from the product itself.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                id="block-active"
                checked={blockDraft.is_active}
                onCheckedChange={(v) => setBlockDraft({ ...blockDraft, is_active: v })}
              />
              <Label htmlFor="block-active">Visible on the website</Label>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={() => void submitBlock()}>
                Save block
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setBlockDraft(null);
                  setMediaPreview(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {sections.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {sections.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">This page has no sections yet.</p>
        )}
        {(sections.data ?? []).map((section, sectionIndex) => {
          const text = (sectionText.data ?? []).find((t: any) => t.section_id === section.id);
          const sectionBlocks = (blocks.data ?? []).filter((b) => b.section_id === section.id);
          return (
            <Card key={section.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{section.internal_name}</p>
                      {!section.is_active && <Badge variant="secondary">Hidden</Badge>}
                    </div>
                    {text?.title && <p className="text-xs text-muted-foreground">{text.title}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="icon"
                      variant="outline"
                      disabled={!canEdit || sectionIndex === 0}
                      aria-label="Move section up"
                      onClick={() => void moveSection(sectionIndex, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      disabled={!canEdit || sectionIndex === (sections.data?.length ?? 0) - 1}
                      aria-label="Move section down"
                      onClick={() => void moveSection(sectionIndex, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Switch
                      checked={section.is_active}
                      disabled={!canEdit}
                      aria-label="Section visible"
                      onCheckedChange={(v) => void toggleSection(section, v)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canEdit}
                      onClick={() =>
                        setSectionDraft({
                          id: section.id,
                          internal_name: section.internal_name,
                          is_active: section.is_active,
                          title: text?.title ?? "",
                          subtitle: text?.subtitle ?? "",
                        })
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      disabled={!canEdit}
                      aria-label="Remove section"
                      onClick={() => void destroySection(section)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5 border-l pl-3">
                  {sectionBlocks.length === 0 && (
                    <p className="text-xs text-muted-foreground">No blocks in this section yet.</p>
                  )}
                  {sectionBlocks.map((block, blockIndex) => (
                    <div key={block.id} className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 text-sm">
                        <span className="font-medium">{block.internal_name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {BLOCK_KIND_LABELS[block.block_kind]}
                        </span>
                        {!block.is_active && (
                          <Badge variant="secondary" className="ml-2">
                            Hidden
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="icon"
                          variant="outline"
                          disabled={!canEdit || blockIndex === 0}
                          aria-label="Move block up"
                          onClick={() => void moveBlock(section.id, blockIndex, -1)}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          disabled={!canEdit || blockIndex === sectionBlocks.length - 1}
                          aria-label="Move block down"
                          onClick={() => void moveBlock(section.id, blockIndex, 1)}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Switch
                          checked={block.is_active}
                          disabled={!canEdit}
                          aria-label="Block visible"
                          onCheckedChange={(v) => void toggleBlock(block, v)}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canEdit}
                          onClick={() => void openBlock(block)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          disabled={!canEdit}
                          aria-label="Remove block"
                          onClick={() => void destroyBlock(block)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1"
                      onClick={() => {
                        setBlockDraft(newBlock(section.id));
                        setMediaPreview(null);
                      }}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add block
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
