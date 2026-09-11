import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { catalogueLabel } from "@/lib/catalogues";

/**
 * Shared "one catalogue at a time" scope for the existing item lists.
 * `?catalogue=<id>` narrows a list to a single catalogue and makes new items
 * land in it. Without it, the list behaves exactly as before.
 */
export const catalogueSearchSchema = (search: Record<string, unknown>) => ({
  catalogue: typeof search["catalogue"] === "string" ? (search["catalogue"] as string) : undefined,
});

export function useCatalogueScope(catalogueId?: string) {
  return useQuery({
    queryKey: ["catalogue", catalogueId],
    enabled: !!catalogueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogues")
        .select("id, internal_name, public_name, template, active")
        .eq("id", catalogueId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function CatalogueScopeBanner({ catalogueId }: { catalogueId?: string }) {
  const { data } = useCatalogueScope(catalogueId);
  if (!catalogueId) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
      <span>
        Showing the items of catalogue{" "}
        <strong>{data ? catalogueLabel(data as never) : "…"}</strong>
        {data && !data.active ? " (inactive — customers see nothing from it)" : ""}
      </span>
      <Link to="/admin/catalogues" className="underline">
        All catalogues
      </Link>
    </div>
  );
}
