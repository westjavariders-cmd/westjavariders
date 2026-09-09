import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";

export type WebsiteLanguage = { code: string; name: string; is_master: boolean };

/** The existing managed language list; the master language is the fallback. */
export function useWebsiteLanguages() {
  const query = useQuery({
    queryKey: ["website-languages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("languages")
        .select("code, name, is_master, is_active, display_order")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw new Error(error.message);
      return (data ?? []) as WebsiteLanguage[];
    },
  });
  const list = query.data ?? [];
  return { list, master: list.find((l) => l.is_master)?.code ?? list[0]?.code ?? "en" };
}

export function LanguagePicker({
  value,
  onChange,
  languages,
}: {
  value: string;
  onChange: (code: string) => void;
  languages: WebsiteLanguage[];
}) {
  if (languages.length < 2) return null;
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="website-language" className="text-xs text-muted-foreground">
        Content language
      </Label>
      <select
        id="website-language"
        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {languages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
            {l.is_master ? " (default)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Existing products, for blocks and buttons that reference them. */
export function useWebsiteProducts() {
  return useQuery({
    queryKey: ["website-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, internal_name, status")
        .order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []) as { id: string; internal_name: string; status: string }[];
    },
  });
}

/** Website pages, for buttons and menu items that point at one. */
export function useWebsitePageOptions() {
  return useQuery({
    queryKey: ["website-page-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_pages")
        .select("id, internal_name, slug, is_active")
        .order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []) as { id: string; internal_name: string; slug: string; is_active: boolean }[];
    },
  });
}
