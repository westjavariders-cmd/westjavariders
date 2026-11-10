import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

/** Credit left, Contact us right — used on every public page including landing. */
export function PublicSiteFooter({ tone = "page" }: { tone?: "page" | "landing" }) {
  return (
    <footer
      className={cn(
        "flex items-end justify-between gap-6",
        tone === "page" && "px-4 pb-10 md:px-8 lg:px-10 xl:px-12",
        tone === "landing" && "mt-10 w-full",
      )}
    >
      <p
        className={cn(
          tone === "page" && "text-xs text-muted-foreground",
          tone === "landing" && "text-[11px] text-neutral-200/65",
        )}
      >
        Services offered by Cimaja Boardriders
      </p>
      <Link
        to="/contact"
        className={cn(
          "shrink-0 underline-offset-4 hover:underline",
          tone === "page" && "text-xs text-muted-foreground",
          tone === "landing" && "text-[11px] text-neutral-200/65",
        )}
      >
        Contact us
      </Link>
    </footer>
  );
}
