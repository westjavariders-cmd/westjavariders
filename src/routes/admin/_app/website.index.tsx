import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { deletePage, reorderPages, savePage } from "@/lib/website.functions";
import { moveInOrder, slugify } from "@/lib/website";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LanguagePicker, useWebsiteLanguages } from "@/components/admin/website/shared";

export const Route = createFileRoute("/admin/_app/website/")({
  component: WebsitePagesScreen,
});

type PageRow = {
  id: string;
  slug: string;
  internal_name: string;
  is_active: boolean;
  sort_order: number;
};

function WebsitePagesScreen() {
  const { adminSession } = Route.useRouteContext();
  const canEdit = adminSession.isAdmin;
  const queryClient = useQueryClient();
  const languages = useWebsiteLanguages();
  const [language, setLanguage] = useState<string>("");
  const activeLanguage = language || languages.master;

  const save = useServerFn(savePage);
  const remove = useServerFn(deletePage);
  const reorder = useServerFn(reorderPages);

  const pages = useQuery({
    queryKey: ["website-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_pages")
        .select("id, slug, internal_name, is_active, sort_order")
        .order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []) as PageRow[];
    },
  });

  const translations = useQuery({
    queryKey: ["website-page-translations", activeLanguage],
    enabled: Boolean(activeLanguage),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_page_translations")
        .select("page_id, title, subtitle")
        .eq("language_code", activeLanguage);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const [draft, setDraft] = useState<{
    id?: string;
    internal_name: string;
    slug: string;
    is_active: boolean;
    title: string;
    subtitle: string;
  } | null>(null);

  const mutate = useMutation({
    mutationFn: (input: NonNullable<typeof draft>) =>
      save({
        data: {
          id: input.id,
          slug: input.slug,
          internal_name: input.internal_name,
          is_active: input.is_active,
          language: activeLanguage,
          title: input.title,
          subtitle: input.subtitle,
        },
      }),
    onSuccess: () => {
      toast.success("Page saved.");
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: ["website-pages"] });
      void queryClient.invalidateQueries({ queryKey: ["website-page-translations"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "The page could not be saved."),
  });

  async function move(index: number, direction: -1 | 1) {
    const rows = pages.data ?? [];
    const next = moveInOrder(rows, index, direction);
    if (next === rows) return;
    try {
      await reorder({ data: { orderedIds: next.map((p) => p.id) } });
      void queryClient.invalidateQueries({ queryKey: ["website-pages"] });
    } catch {
      toast.error("The pages could not be reordered.");
    }
  }

  async function toggle(page: PageRow, isActive: boolean) {
    const text = (translations.data ?? []).find((t: any) => t.page_id === page.id);
    try {
      await save({
        data: {
          id: page.id,
          slug: page.slug,
          internal_name: page.internal_name,
          is_active: isActive,
          language: activeLanguage,
          title: text?.title ?? null,
          subtitle: text?.subtitle ?? null,
        },
      });
      void queryClient.invalidateQueries({ queryKey: ["website-pages"] });
    } catch {
      toast.error("This page could not be changed.");
    }
  }

  async function destroy(page: PageRow) {
    if (!window.confirm(`Remove the page "${page.internal_name}" and all of its content?`)) return;
    try {
      await remove({ data: { id: page.id } });
      toast.success("Page removed.");
      void queryClient.invalidateQueries({ queryKey: ["website-pages"] });
    } catch {
      toast.error("This page could not be removed.");
    }
  }

  return (
    <>
      <PageHeader
        title="Website pages"
        description="What exists on the public website, in which order, and whether it is visible."
        breadcrumb={["Admin", "Website", "Pages"]}
        actions={
          canEdit && (
            <Button
              size="sm"
              onClick={() =>
                setDraft({ internal_name: "", slug: "", is_active: true, title: "", subtitle: "" })
              }
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New page
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
                <Label htmlFor="page-name">Internal name</Label>
                <Input
                  id="page-name"
                  value={draft.internal_name}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      internal_name: e.target.value,
                      slug: draft.id ? draft.slug : slugify(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="page-slug">Web address</Label>
                <Input
                  id="page-slug"
                  value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: slugify(e.target.value) })}
                />
                <p className="mt-1 text-xs text-muted-foreground">/pages/{draft.slug || "…"}</p>
              </div>
              <div>
                <Label htmlFor="page-title">Displayed title ({activeLanguage})</Label>
                <Input
                  id="page-title"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="page-subtitle">Supporting text ({activeLanguage})</Label>
                <Input
                  id="page-subtitle"
                  value={draft.subtitle}
                  onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="page-active"
                checked={draft.is_active}
                onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
              />
              <Label htmlFor="page-active">Visible on the website</Label>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={mutate.isPending} onClick={() => mutate.mutate(draft)}>
                Save page
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {pages.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {pages.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No pages configured yet.</p>
        )}
        {(pages.data ?? []).map((page, index) => {
          const text = (translations.data ?? []).find((t: any) => t.page_id === page.id);
          return (
            <Card key={page.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      to="/admin/website/$pageId"
                      params={{ pageId: page.id }}
                      className="font-medium underline underline-offset-2"
                    >
                      {page.internal_name}
                    </Link>
                    {!page.is_active && <Badge variant="secondary">Hidden</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    /pages/{page.slug}
                    {text?.title ? ` · ${text.title}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <a
                    href={page.slug === "home" ? "/" : `/pages/${page.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mr-1 text-muted-foreground hover:text-foreground"
                    aria-label="Open on the website"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
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
                    disabled={!canEdit || index === (pages.data?.length ?? 0) - 1}
                    aria-label="Move down"
                    onClick={() => void move(index, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Switch
                    checked={page.is_active}
                    disabled={!canEdit}
                    aria-label="Visible"
                    onCheckedChange={(v) => void toggle(page, v)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() =>
                      setDraft({
                        id: page.id,
                        internal_name: page.internal_name,
                        slug: page.slug,
                        is_active: page.is_active,
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
                    aria-label="Remove page"
                    onClick={() => void destroy(page)}
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
