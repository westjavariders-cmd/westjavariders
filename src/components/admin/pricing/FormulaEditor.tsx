import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

import { activateFormulaVersion, createFormulaVersion } from "@/lib/pricing.functions";
import { formulaVariableNames, type FormulaVersion, type ProductPricing } from "@/lib/pricing";
import type { ProductBundle } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Advanced formulas. An active version can never be edited: saving creates the
 * next version, and activation is validated on the server.
 */
export function FormulaEditor({
  bundle,
  pricing,
  versions,
  canEdit,
  reload,
}: {
  bundle: ProductBundle;
  pricing: ProductPricing;
  versions: FormulaVersion[];
  canEdit: boolean;
  reload: () => void;
}) {
  const create = useServerFn(createFormulaVersion);
  const activate = useServerFn(activateFormulaVersion);
  const active = versions.find((v) => v.is_active) ?? null;
  const [expression, setExpression] = useState(active?.expression ?? "");
  const [busy, setBusy] = useState(false);

  const variables = formulaVariableNames(bundle, pricing);

  async function saveVersion() {
    setBusy(true);
    try {
      const res = await create({ data: { productId: bundle.product.id, expression } });
      toast.success(`Version ${res.version} created.`);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This formula could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function activateVersion(versionId: string) {
    try {
      await activate({ data: { productId: bundle.product.id, versionId } });
      toast.success("Formula version activated.");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This version could not be activated.");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div>
            <Label className="text-xs">Formula</Label>
            <Textarea
              rows={4}
              className="font-mono text-xs"
              value={expression}
              disabled={!canEdit}
              onChange={(e) => setExpression(e.target.value)}
              placeholder='base + people * 250000 + IF(level == "Advanced", 500000, 0)'
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Allowed: + - * / ( ) comparisons, IF, MIN, MAX, CONTAINS. Nothing else can be used.
            </p>
          </div>
          {canEdit && (
            <Button size="sm" onClick={saveVersion} disabled={busy || !expression.trim()}>
              Save as new version
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          <h3 className="text-sm font-medium">Available values</h3>
          <div className="flex flex-wrap gap-1.5">
            {variables.map((v) => (
              <Badge key={v.name} variant="secondary" className="font-mono text-[11px]">
                {v.name} · {v.type}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          <h3 className="text-sm font-medium">Versions</h3>
          {versions.length === 0 && <p className="text-sm text-muted-foreground">No version yet.</p>}
          {[...versions]
            .sort((a, b) => b.version - a.version)
            .map((v) => (
              <div key={v.id} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2">
                <Badge variant={v.is_active ? "default" : "secondary"}>v{v.version}</Badge>
                <code className="min-w-0 flex-1 truncate text-[11px]">{v.expression}</code>
                {v.is_active ? (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5" /> active · locked
                  </span>
                ) : (
                  canEdit && (
                    <Button size="sm" variant="outline" onClick={() => activateVersion(v.id)}>
                      Activate
                    </Button>
                  )
                )}
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
