/**
 * Whole-site translation panel — Admin only.
 *
 * Translates every customer-facing text into one language and lets an admin
 * correct any of those texts by hand. It never touches prices, products,
 * catalogues, the configurator or vouchers: only the wording shown.
 */
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { listTranslations, saveTranslation, translateSite } from "@/lib/translations.functions";

type Language = { code: string; name: string; is_master: boolean; is_active: boolean };

const SCOPE_LABEL: Record<string, string> = {
  product: "Experiences",
  step: "Configurator steps",
  field: "Configurator questions",
  field_option: "Configurator options",
  accommodation_room: "Accommodation",
  transport: "Transport",
  motorbike: "Motorbikes",
  catalogue: "Catalogue labels",
  ui: "Interface texts",
};

export function SiteTranslation({
  languages,
  canEdit,
}: {
  languages: Language[];
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const runTranslateSite = useServerFn(translateSite);
  const loadTranslations = useServerFn(listTranslations);
  const persist = useServerFn(saveTranslation);

  const targets = languages.filter((l) => l.is_active && !l.is_master);
  const [language, setLanguage] = useState<string>(targets[0]?.code ?? "");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const rows = useQuery({
    queryKey: ["site-translations", language],
    enabled: language !== "",
    queryFn: () => loadTranslations({ data: { language } }),
  });

  const translate = useMutation({
    mutationFn: (overwrite: boolean) => runTranslateSite({ data: { language, overwrite } }),
    onSuccess: (result: { translated: number }) => {
      toast.success(
        result.translated === 0
          ? "Nothing left to translate."
          : `Translated ${result.translated} texts.`,
      );
      queryClient.invalidateQueries({ queryKey: ["site-translations"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "The texts could not be translated."),
  });

  const save = useMutation({
    mutationFn: (vars: { scope: string; ref: string; field: string; value: string }) =>
      persist({ data: { ...vars, language } }),
    onSuccess: () => {
      toast.success("Saved.");
      queryClient.invalidateQueries({ queryKey: ["site-translations"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Save failed."),
  });

  if (targets.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Translate the site</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Activate another language above to start translating.
          </p>
        </CardContent>
      </Card>
    );
  }

  const grouped = new Map<string, typeof rows.data>();
  for (const row of rows.data ?? []) {
    const list = grouped.get(row.scope) ?? [];
    (list as any[]).push(row);
    grouped.set(row.scope, list as never);
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Translate the site</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {targets.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
          {canEdit && (
            <>
              <Button
                variant="outline"
                disabled={translate.isPending || language === ""}
                onClick={() => translate.mutate(false)}
              >
                {translate.isPending ? "Translating…" : "Translate everything"}
              </Button>
              <Button
                variant="ghost"
                disabled={translate.isPending || language === ""}
                onClick={() => translate.mutate(true)}
              >
                Retranslate everything
              </Button>
            </>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Pages, menu, entry screen, experiences, configurator questions, catalogues and interface
          texts. Anything you have already written by hand is kept; use Retranslate to redo it.
        </p>

        {rows.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {rows.data && rows.data.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No translated texts yet for this language.
          </p>
        )}

        {Array.from(grouped.entries()).map(([scope, list]) => (
          <div key={scope} className="space-y-2">
            <h3 className="text-sm font-medium">{SCOPE_LABEL[scope] ?? scope}</h3>
            <div className="space-y-3">
              {(list ?? []).map((row) => {
                const key = `${row.scope}|${row.ref}|${row.field}`;
                const value = drafts[key] ?? row.value ?? "";
                const dirty = value !== (row.value ?? "");
                return (
                  <div key={key} className="rounded-md border p-3">
                    <p className="mb-1 text-xs text-muted-foreground">
                      {row.field} — {row.source || row.ref}
                    </p>
                    <Textarea
                      rows={2}
                      value={value}
                      disabled={!canEdit}
                      onChange={(event) =>
                        setDrafts((d) => ({ ...d, [key]: event.target.value }))
                      }
                    />
                    {canEdit && (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!dirty || save.isPending}
                          onClick={() =>
                            save.mutate({
                              scope: row.scope,
                              ref: row.ref,
                              field: row.field,
                              value,
                            })
                          }
                        >
                          Save
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
