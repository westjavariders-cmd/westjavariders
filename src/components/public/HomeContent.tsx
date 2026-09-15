import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { WebsiteRenderer } from "@/components/public/WebsiteRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearStoredPromoCode,
  readStoredPromoCode,
  writeStoredPromoCode,
} from "@/lib/promo-code-storage";
import type { PublicWebsitePage } from "@/lib/website.server";

/** Discreet promo code entry. The code is kept in the browser and applied to every quote. */
function PromoCodeEntry() {
  const [applied, setApplied] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setApplied(readStoredPromoCode());
  }, []);

  if (applied && !open) {
    return (
      <p className="text-xs text-muted-foreground">
        Promo code <span className="font-mono">{applied}</span> applied ·{" "}
        <button
          type="button"
          className="underline underline-offset-2"
          onClick={() => {
            clearStoredPromoCode();
            setApplied(null);
            setDraft("");
          }}
        >
          Remove
        </button>
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="text-xs text-muted-foreground underline underline-offset-2"
        onClick={() => {
          setDraft(applied ?? "");
          setOpen(true);
        }}
      >
        Have a promo code?
      </button>
    );
  }

  return (
    <form
      className="flex max-w-xs items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const code = draft.trim().toUpperCase().slice(0, 40);
        writeStoredPromoCode(code);
        setApplied(code || null);
        setOpen(false);
      }}
    >
      <Input
        autoFocus
        value={draft}
        maxLength={40}
        placeholder="Enter a code"
        className="h-8 text-xs"
        onChange={(e) => setDraft(e.target.value.toUpperCase())}
      />
      <Button type="submit" size="sm">
        Apply
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}

/** The configured Home content, shared by the site root and /home. */
export function HomeContent({ page }: { page: PublicWebsitePage | null }) {
  return (
    <div className="py-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        {page?.title ?? "Surf, travel and local experiences in Cimaja"}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {page?.subtitle ??
          "West Java's warm-water pointbreaks, local guides and trips built exactly the way you want them."}
      </p>

      {page && page.sections.length > 0 ? (
        <WebsiteRenderer page={page} showHeading={false} />
      ) : (
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/build-your-trip">Build your trip</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/cart">View your cart</Link>
          </Button>
        </div>
      )}

      <div className="mt-10 space-y-2">
        <PromoCodeEntry />
        <p className="text-xs text-muted-foreground">
          <Link to="/admin" className="underline underline-offset-2">
            Staff sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
