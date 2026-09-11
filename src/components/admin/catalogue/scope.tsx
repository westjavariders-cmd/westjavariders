import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

/**
 * Catalogue scope for the item editors.
 *
 * Every item editor works inside ONE catalogue instance, named by the
 * `?catalogue=` search value. Without it the editor lists every item of its
 * behaviour, exactly as it did before catalogue instances existed.
 */
export function catalogueSearch(search: Record<string, unknown>): { catalogue?: string } {
  const value = search["catalogue"];
  return typeof value === "string" && value ? { catalogue: value } : {};
}

export type ScopedCatalogue = {
  id: string;
  internal_name: string;
  public_name: string | null;
  active: boolean;
};

export function useCatalogueScope(catalogueId?: string) {
  return useQuery({
    queryKey: ["catalogue-scope", catalogueId ?? null],
    enabled: !!catalogueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogues")
        .select("id, internal_name, public_name, active")
        .eq("id", catalogueId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as ScopedCatalogue | null;
    },
  });
}

export function CatalogueScopeNote({ catalogue }: { catalogue: ScopedCatalogue | null | undefined }) {
  if (!catalogue) return null;
  return (
    <p className="mb-4 text-sm text-muted-foreground">
      You are managing the items of <span className="font-medium">{catalogue.internal_name}</span>. Items
      created here belong only to this catalogue.{" "}
      <Link to="/admin/catalogues" className="underline">
        All catalogues
      </Link>
    </p>
  );
}
