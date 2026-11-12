import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { exportStorageManifest } from "@/lib/storage-export.functions";

export const Route = createFileRoute("/admin/_app/export-files")({
  head: () => ({ meta: [{ title: "Export files — Admin" }, { name: "robots", content: "noindex" }] }),
  component: ExportFilesPage,
});

const SCRIPT = `// migrate-storage.mjs — copies files from storage-manifest.json into the NEW project.
// Usage:
//   npm install @supabase/supabase-js
//   NEW_SUPABASE_URL=https://xxxx.supabase.co NEW_SERVICE_ROLE_KEY=... node migrate-storage.mjs storage-manifest.json
// Safe to re-run: files already present in the new project are skipped, never duplicated or overwritten.
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEW_SUPABASE_URL;
const key = process.env.NEW_SERVICE_ROLE_KEY;
const manifestPath = process.argv[2] ?? "storage-manifest.json";
if (!url || !key) { console.error("Set NEW_SUPABASE_URL and NEW_SERVICE_ROLE_KEY"); process.exit(1); }

const sb = createClient(url, key, { auth: { persistSession: false } });
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (new Date(manifest.expires_at) < new Date()) {
  console.error("Links expired. Generate a new list in Admin → Export files."); process.exit(1);
}

async function exists(bucket, path) {
  const i = path.lastIndexOf("/");
  const dir = i < 0 ? "" : path.slice(0, i);
  const name = path.slice(i + 1);
  const { data } = await sb.storage.from(bucket).list(dir, { search: name, limit: 100 });
  return (data ?? []).some((f) => f.name === name);
}

async function withRetry(fn, tries = 3) {
  for (let n = 1; ; n++) {
    try { return await fn(); } catch (e) { if (n >= tries) throw e; await new Promise((r) => setTimeout(r, 1000 * n)); }
  }
}

let copied = 0, skipped = 0;
const failed = [];
for (const f of manifest.files) {
  const label = f.bucket + "/" + f.path;
  try {
    if (await exists(f.bucket, f.path)) { skipped++; console.log("skip  ", label); continue; }
    const body = await withRetry(async () => {
      const res = await fetch(f.signed_url);
      if (!res.ok) throw new Error("download " + res.status);
      return new Uint8Array(await res.arrayBuffer());
    });
    await withRetry(async () => {
      const { error } = await sb.storage.from(f.bucket).upload(f.path, body, {
        contentType: f.content_type ?? undefined, upsert: false,
      });
      if (error && !/exists|duplicate/i.test(error.message)) throw new Error(error.message);
    });
    copied++; console.log("copied", label);
  } catch (e) {
    failed.push({ ...f, error: String(e?.message ?? e) }); console.error("FAILED", label, e?.message ?? e);
  }
}

// Final check: every file in the manifest must now exist in the new project.
let present = 0;
for (const f of manifest.files) if (await exists(f.bucket, f.path)) present++;

await writeFile("failed.json", JSON.stringify({ ...manifest, files: failed }, null, 2));
console.log(\`\\nCopied \${copied}, already there \${skipped}, failed \${failed.length}.\`);
console.log(\`Present in new project: \${present} / \${manifest.total}\`);
if (failed.length) console.log("Re-run to retry (or: node migrate-storage.mjs failed.json).");
`;

function ExportFilesPage() {
  const run = useServerFn(exportStorageManifest);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ total: number; counts: Record<string, number>; errors: string[]; expires_at: string } | null>(null);

  async function generate() {
    setBusy(true);
    try {
      const manifest = await run();
      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "storage-manifest.json";
      a.click();
      URL.revokeObjectURL(a.href);
      setResult(manifest);
      toast.success(`Download list ready: ${manifest.total} files.`);
    } catch {
      toast.error("The list could not be generated. Only an ADMIN can do this.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Export files"
        description="Temporary migration tool. Read-only: nothing is changed or deleted."
        breadcrumb={["Admin", "Settings", "Export files"]}
      />
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-muted-foreground">
              Generates storage-manifest.json with every file (all subfolders), its exact path and a
              download link valid for 1 hour.
            </p>
            <Button onClick={generate} disabled={busy}>
              {busy ? "Generating…" : "Generate download list"}
            </Button>
            {result && (
              <div className="text-sm">
                <p className="font-medium">Total: {result.total} files · links expire {new Date(result.expires_at).toLocaleTimeString()}</p>
                <ul className="mt-1 text-muted-foreground">
                  {Object.entries(result.counts).map(([b, n]) => (
                    <li key={b}>{b}: {n}</li>
                  ))}
                </ul>
                {result.errors.length > 0 && (
                  <p className="mt-2 text-destructive">Problems: {result.errors.join("; ")}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center justify-between">
              <p className="font-medium">Copy script (run on your computer)</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(SCRIPT);
                  toast.success("Script copied.");
                }}
              >
                Copy script
              </Button>
            </div>
            <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-xs">{SCRIPT}</pre>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
