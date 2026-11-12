import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * TEMPORARY migration tool (read-only). Lists every file in the app's storage
 * containers, including subfolders, and returns 1-hour signed download links.
 * Never writes, moves or deletes anything. Remove after the migration.
 */
export const EXPORT_BUCKETS = [
  "accommodation-photos",
  "voucher-documents",
  "motorbike-photos",
  "website-media",
  "product-media",
] as const;

export const SIGNED_URL_SECONDS = 3600;

export type ManifestFile = {
  bucket: string;
  path: string;
  size: number | null;
  content_type: string | null;
  signed_url: string;
};

export const exportStorageManifest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const { data: isAdmin, error: roleError } = await supabase.rpc("is_admin");
    if (roleError || isAdmin !== true) throw new Error("Only an ADMIN may export files.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const files: ManifestFile[] = [];
    const errors: string[] = [];

    for (const bucket of EXPORT_BUCKETS) {
      const found: { path: string; size: number | null; type: string | null }[] = [];
      const queue: string[] = [""];
      while (queue.length) {
        const prefix = queue.shift() as string;
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
          if (error) {
            errors.push(`${bucket}/${prefix}: ${error.message}`);
            break;
          }
          for (const entry of data ?? []) {
            const full = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.id === null) queue.push(full); // folder
            else if (entry.name !== ".emptyFolderPlaceholder")
              found.push({
                path: full,
                size: (entry.metadata as any)?.size ?? null,
                type: (entry.metadata as any)?.mimetype ?? null,
              });
          }
          if (!data || data.length < 1000) break;
        }
      }
      for (let i = 0; i < found.length; i += 100) {
        const chunk = found.slice(i, i + 100);
        const { data, error } = await supabaseAdmin.storage
          .from(bucket)
          .createSignedUrls(chunk.map((f) => f.path), SIGNED_URL_SECONDS);
        if (error) {
          errors.push(`${bucket}: ${error.message}`);
          continue;
        }
        chunk.forEach((f, idx) => {
          const url = data?.[idx]?.signedUrl;
          if (!url) errors.push(`${bucket}/${f.path}: no signed link`);
          else
            files.push({ bucket, path: f.path, size: f.size, content_type: f.type, signed_url: url });
        });
      }
    }

    const counts: Record<string, number> = {};
    for (const b of EXPORT_BUCKETS) counts[b] = files.filter((f) => f.bucket === b).length;
    return {
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + SIGNED_URL_SECONDS * 1000).toISOString(),
      total: files.length,
      counts,
      errors,
      files,
    };
  });
