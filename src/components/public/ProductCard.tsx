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
        "group relative isolate flex h-full min-h-[58vw] overflow-hidden bg-secondary",
        "sm:min-h-[20rem] md:min-h-[22rem] lg:min-h-[24rem]",
        !bookable && "opacity-70",
      )}
    >
      {imageUrl ? (
        <div className="absolute inset-0 overflow-hidden">
          <div className="size-full origin-center transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none">
            <img
              src={imageUrl}
              alt={title}
              loading="lazy"
              className="absolute inset-0 size-full object-cover object-center"
            />
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 bg-secondary" aria-hidden="true" />
      )}

      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/15",
          "transition-colors duration-500 group-hover:from-black/70 group-hover:via-black/35",
          "motion-reduce:transition-none",
        )}
      />

      <div className="relative z-10 mt-auto flex w-full flex-col justify-end gap-2 p-5 sm:p-6">
        <h3 className="text-balance text-2xl font-semibold tracking-tight text-neutral-50 sm:text-3xl">
          {title}
        </h3>
        {summary && (
          <p className="max-w-md line-clamp-2 text-sm leading-relaxed text-neutral-200/90 sm:text-[0.95rem]">
            {summary}
          </p>
        )}
        {bookable ? (
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-50">
            View trip
            <span
              aria-hidden="true"
              className="ml-2 inline-block transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transform-none"
            >
              →
            </span>
          </p>
        ) : (
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-200/80">
            Not available for booking right now
          </p>
        )}
      </div>
    </article>
  );

  if (!bookable) return inner;

  return (
    <Link
      to="/build-your-trip/$productId"
      params={{ productId }}
      className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {inner}
    </Link>
  );
}
