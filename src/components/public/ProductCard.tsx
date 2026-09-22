import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

type ProductCardProps = {
  productId: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  bookable: boolean;
};

export function ProductCard({ productId, title, summary, imageUrl, bookable }: ProductCardProps) {
  const inner = (
    <article
      className={cn(
        "h-full overflow-hidden rounded-lg border border-border/70 bg-background",
        "transition-[border-color,box-shadow] duration-300",
        bookable && "hover:border-foreground/20 hover:shadow-sm",
        !bookable && "opacity-70",
      )}
    >
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            className={cn(
              "size-full object-cover",
              bookable &&
                "origin-center transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none",
            )}
          />
        ) : (
          <div className="size-full bg-muted" aria-hidden="true" />
        )}
      </div>
      <div className="space-y-2 p-4 sm:p-5">
        <h3 className="text-balance text-lg font-semibold leading-snug tracking-tight">{title}</h3>
        {summary && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{summary}</p>
        )}
        {bookable ? (
          <p className="pt-1 text-sm font-medium tracking-wide">
            View trip
            <span aria-hidden="true" className="ml-1">
              →
            </span>
          </p>
        ) : (
          <p className="pt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Not available for booking right now
          </p>
        )}
      </div>
    </article>
  );

  if (!bookable) return inner;

  return (
    <Link to="/build-your-trip/$productId" params={{ productId }} className="group block h-full">
      {inner}
    </Link>
  );
}
