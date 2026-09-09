import { Link } from "@tanstack/react-router";

import { WebsiteRenderer } from "@/components/public/WebsiteRenderer";
import { Button } from "@/components/ui/button";
import type { PublicWebsitePage } from "@/lib/website.server";

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

      <p className="mt-10 text-xs text-muted-foreground">
        <Link to="/admin" className="underline underline-offset-2">
          Staff sign in
        </Link>
      </p>
    </div>
  );
}
