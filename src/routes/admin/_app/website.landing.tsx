import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { saveChromeImage, saveLanding } from "@/lib/website.functions";
import {
  DESTINATION_KINDS,
  DESTINATION_LABELS,
  HEADER_BACKGROUND_SETTING_KEY,
  SITE_BACKGROUND_SETTING_KEY,
  WEBSITE_MEDIA_BUCKET,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin/_app/website/landing")({
  component: WebsiteLandingScreen,
});

const selectClass = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm";

type LandingRow = {
  id: string;
  is_active: boolean;
  video_path: string | null;
  image_path: string | null;
  image_alt: string | null;
  cta_kind: DestinationKind;
  cta_page_id: string | null;
  cta_product_id: string | null;
  cta_external_url: string | null;
};

function WebsiteLandingScreen() {
  const { adminSession } = Route.useRouteContext();
  const canEdit = adminSession.isAdmin;
  const queryClient = useQueryClient();

  const languages = useWebsiteLanguages();
  const [language, setLanguage] = useState("");
  const activeLanguage = language || languages.master;

  const pageOptions = useWebsitePageOptions();
  const products = useWebsiteProducts();
  const persist = useServerFn(saveLanding);
  const persistChrome = useServerFn(saveChromeImage);

  const landing = useQuery({
    queryKey: ["website-landing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_landing")
        .select(
          "id, is_active, video_path, image_path, image_alt, cta_kind, cta_page_id, cta_product_id, cta_external_url",
        )
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as LandingRow | null;
    },
  });

  const translation = useQuery({
    queryKey: ["website-landing-text", activeLanguage],
    enabled: Boolean(activeLanguage),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_landing_translations")
        .select("title, subtitle, cta_label")
        .eq("language_code", activeLanguage)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as { title: string | null; subtitle: string | null; cta_label: string | null } | null;
    },
  });

  const chromeImages = useQuery({
    queryKey: ["website-chrome-image-paths"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", [SITE_BACKGROUND_SETTING_KEY, HEADER_BACKGROUND_SETTING_KEY]);
      if (error) throw new Error(error.message);
      const byKey = new Map((data ?? []).map((row) => [row.key as string, ((row.value as string) ?? "").trim()]));
      return {
        site: byKey.get(SITE_BACKGROUND_SETTING_KEY) || null,
        header: byKey.get(HEADER_BACKGROUND_SETTING_KEY) || null,
      };
    },
  });

  const [form, setForm] = useState({
    is_active: false,
    video_path: null as string | null,
    image_path: null as string | null,
    site_background_path: null as string | null,
    header_background_path: null as string | null,
    image_alt: "",
    cta_kind: "page" as DestinationKind,
    cta_page_id: null as string | null,
    cta_product_id: null as string | null,
    cta_external_url: "",
    title: "",
    subtitle: "",
    cta_label: "",
  });

  useEffect(() => {
    const row = landing.data;
    const text = translation.data;
    setForm({
      is_active: row?.is_active ?? false,
      video_path: row?.video_path ?? null,
      image_path: row?.image_path ?? null,
      site_background_path: chromeImages.data?.site ?? null,
      header_background_path: chromeImages.data?.header ?? null,
      image_alt: row?.image_alt ?? "",
      cta_kind: row?.cta_kind ?? "page",
      cta_page_id: row?.cta_page_id ?? null,
      cta_product_id: row?.cta_product_id ?? null,
      cta_external_url: row?.cta_external_url ?? "",
      title: text?.title ?? "",
      subtitle: text?.subtitle ?? "",
      cta_label: text?.cta_label ?? "",
    });
  }, [landing.data, translation.data, chromeImages.data]);

  const [previews, setPreviews] = useState<{
    video: string | null;
    image: string | null;
    site: string | null;
    header: string | null;
  }>({
    video: null,
    image: null,
    site: null,
    header: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function sign(path: string | null) {
      if (!path) return null;
      const { data } = await supabase.storage.from(WEBSITE_MEDIA_BUCKET).createSignedUrl(path, 3600);
      return data?.signedUrl ?? null;
    }
    void (async () => {
      const [video, image, site, header] = await Promise.all([
        sign(form.video_path),
        sign(form.image_path),
        sign(form.site_background_path),
        sign(form.header_background_path),
      ]);
      if (!cancelled) setPreviews({ video, image, site, header });
    })();
    return () => {
      cancelled = true;
    };
  }, [form.video_path, form.image_path, form.site_background_path, form.header_background_path]);

  const videoInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const siteBackgroundInput = useRef<HTMLInputElement>(null);
  const headerBackgroundInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(files: FileList | null, kind: "video" | "image" | "site" | "header") {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path =
        kind === "site"
          ? `site-background/${Date.now()}-${safeName}`
          : kind === "header"
            ? `header-background/${Date.now()}-${safeName}`
            : `landing/${kind}-${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from(WEBSITE_MEDIA_BUCKET).upload(path, file);
      if (error) throw new Error(error.message);
      setForm((f) =>
        kind === "video"
          ? { ...f, video_path: path }
          : kind === "site"
            ? { ...f, site_background_path: path }
            : kind === "header"
              ? { ...f, header_background_path: path }
              : { ...f, image_path: path },
      );
      toast.success("Uploaded. Save to keep it.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This file could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await persist({
        data: {
          is_active: form.is_active,
          video_path: form.video_path,
          image_path: form.image_path,
          image_alt: form.image_alt,
          cta_kind: form.cta_kind,
          cta_page_id: form.cta_page_id,
          cta_product_id: form.cta_product_id,
          cta_external_url: form.cta_external_url,
          language: activeLanguage,
          title: form.title,
          subtitle: form.subtitle,
          cta_label: form.cta_label,
        },
      });
      await persistChrome({ data: { slot: "site", image_path: form.site_background_path } });
      await persistChrome({ data: { slot: "header", image_path: form.header_background_path } });
      await queryClient.invalidateQueries({ queryKey: ["website-landing"] });
      await queryClient.invalidateQueries({ queryKey: ["website-landing-text", activeLanguage] });
      await queryClient.invalidateQueries({ queryKey: ["website-chrome-image-paths"] });
      await queryClient.invalidateQueries({ queryKey: ["website-chrome-images"] });
      toast.success("Entry screen saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entry / Landing"
        description="The screen visitors see when they arrive, before the home page."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={form.is_active ? "default" : "secondary"}>
          {form.is_active ? "Shown at the site entrance" : "Off — visitors go straight to Home"}
        </Badge>
        <LanguagePicker value={activeLanguage} onChange={setLanguage} languages={languages.list} />
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="text-xs underline underline-offset-2"
        >
          Open the site entrance
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visibility</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Switch
            id="landing-active"
            checked={form.is_active}
            disabled={!canEdit}
            onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
          />
          <Label htmlFor="landing-active">Show the entry screen</Label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Background</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Background video</Label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={videoInput}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => void upload(e.target.files, "video")}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!canEdit || uploading}
                onClick={() => videoInput.current?.click()}
              >
                {form.video_path ? "Replace video" : "Upload video"}
              </Button>
              {form.video_path && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canEdit}
                  onClick={() => setForm((f) => ({ ...f, video_path: null }))}
                >
                  Remove
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                {form.video_path ? "A video is set." : "No video yet."}
              </span>
            </div>
            {previews.video && (
              <video src={previews.video} muted loop playsInline controls className="max-h-48 rounded-md" />
            )}
          </div>

          <div className="space-y-2">
            <Label>Fallback image</Label>
            <p className="text-xs text-muted-foreground">
              Shown while the video loads and whenever it cannot play.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={imageInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void upload(e.target.files, "image")}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!canEdit || uploading}
                onClick={() => imageInput.current?.click()}
              >
                {form.image_path ? "Replace image" : "Upload image"}
              </Button>
              {form.image_path && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canEdit}
                  onClick={() => setForm((f) => ({ ...f, image_path: null }))}
                >
                  Remove
                </Button>
              )}
            </div>
            {previews.image && <img src={previews.image} alt="" className="max-h-48 rounded-md" />}
            <div className="space-y-1">
              <Label htmlFor="landing-alt">Image description</Label>
              <Input
                id="landing-alt"
                value={form.image_alt}
                disabled={!canEdit}
                maxLength={200}
                placeholder="Surfer walking to the point at Cimaja"
                onChange={(e) => setForm((f) => ({ ...f, image_alt: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Site pages background</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Shown behind Home, menus and the rest of the public site. The entry screen above keeps its own photo.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={siteBackgroundInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void upload(e.target.files, "site")}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!canEdit || uploading}
              onClick={() => siteBackgroundInput.current?.click()}
            >
              {form.site_background_path ? "Replace image" : "Upload image"}
            </Button>
            {form.site_background_path && (
              <Button
                size="sm"
                variant="ghost"
                disabled={!canEdit}
                onClick={() => setForm((f) => ({ ...f, site_background_path: null }))}
              >
                Remove
              </Button>
            )}
          </div>
          {previews.site && <img src={previews.site} alt="" className="max-h-48 rounded-md" />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Header bar image</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Fills the top menu bar and the Surf, Explore, Experience West Java button. If empty, the site pages
            background is used instead.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={headerBackgroundInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void upload(e.target.files, "header")}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!canEdit || uploading}
              onClick={() => headerBackgroundInput.current?.click()}
            >
              {form.header_background_path ? "Replace image" : "Upload image"}
            </Button>
            {form.header_background_path && (
              <Button
                size="sm"
                variant="ghost"
                disabled={!canEdit}
                onClick={() => setForm((f) => ({ ...f, header_background_path: null }))}
              >
                Remove
              </Button>
            )}
          </div>
          {previews.header && <img src={previews.header} alt="" className="max-h-48 rounded-md" />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wording</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="landing-title">Title</Label>
            <Input
              id="landing-title"
              value={form.title}
              disabled={!canEdit}
              maxLength={200}
              placeholder="WEST JAVA RIDERS"
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="landing-subtitle">Subtitle</Label>
            <Input
              id="landing-subtitle"
              value={form.subtitle}
              disabled={!canEdit}
              maxLength={500}
              placeholder="SURF. EXPLORE. EXPERIENCE WEST JAVA."
              onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Left empty, this language falls back to the default language.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Button</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="landing-cta-label">Button text</Label>
            <Input
              id="landing-cta-label"
              value={form.cta_label}
              disabled={!canEdit}
              maxLength={80}
              placeholder="ENTER WEST JAVA RIDERS"
              onChange={(e) => setForm((f) => ({ ...f, cta_label: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="landing-cta-kind">Goes to</Label>
            <select
              id="landing-cta-kind"
              className={selectClass}
              value={form.cta_kind}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, cta_kind: e.target.value as DestinationKind }))}
            >
              {DESTINATION_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {DESTINATION_LABELS[kind]}
                </option>
              ))}
            </select>
          </div>
          {form.cta_kind === "page" && (
            <div className="space-y-1">
              <Label htmlFor="landing-cta-page">Page</Label>
              <select
                id="landing-cta-page"
                className={selectClass}
                value={form.cta_page_id ?? ""}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, cta_page_id: e.target.value || null }))}
              >
                <option value="">Choose a page…</option>
                {(pageOptions.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.internal_name} (/{p.slug}){p.is_active ? "" : " — off"}
                  </option>
                ))}
              </select>
            </div>
          )}
          {form.cta_kind === "product" && (
            <div className="space-y-1">
              <Label htmlFor="landing-cta-product">Product</Label>
              <select
                id="landing-cta-product"
                className={selectClass}
                value={form.cta_product_id ?? ""}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, cta_product_id: e.target.value || null }))}
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
          {form.cta_kind === "external" && (
            <div className="space-y-1">
              <Label htmlFor="landing-cta-url">Link</Label>
              <Input
                id="landing-cta-url"
                value={form.cta_external_url}
                disabled={!canEdit}
                placeholder="https://"
                onChange={(e) => setForm((f) => ({ ...f, cta_external_url: e.target.value }))}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {canEdit ? (
        <Button onClick={() => void save()} disabled={saving || uploading}>
          {saving ? "Saving…" : "Save entry screen"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          You can view this configuration. Only an Admin can change it.
        </p>
      )}
    </div>
  );
}
