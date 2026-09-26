import type { PublicBlock } from "@/lib/website.server";
import { cn } from "@/lib/utils";

type DoorCardProps = {
  block: PublicBlock;
  featured?: boolean;
  /** Home keeps the mosaic. Internal pages use equal selection tiles. */
  layout?: "mosaic" | "selection";
};

function DoorMedia({
  media,
  title,
}: {
  media: NonNullable<PublicBlock["media"]>;
  title: string | null;
}) {
  const frame = "absolute inset-0 size-full object-cover";

  if (media.kind === "video") {
    return (
      <video
        className={frame}
        src={media.url}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
      />
    );
  }

  return <img src={media.url} alt={title ?? ""} className={frame} loading="lazy" />;
}

export function DoorCard({ block, featured = false, layout = "mosaic" }: DoorCardProps) {
  const mosaicFeatured = layout === "mosaic" && featured;

  const inner = (
    <div
      className={cn(
        "group relative isolate flex h-full min-h-[62vw] overflow-hidden bg-secondary cbr-photo-tile",
        layout === "mosaic" && "md:min-h-[28rem] lg:min-h-[34rem] xl:min-h-[38rem]",
        mosaicFeatured && "md:min-h-[34rem] lg:min-h-[42rem] xl:min-h-[46rem]",
        layout === "selection" && "md:min-h-[22rem] lg:min-h-[24rem]",
      )}
    >
      {block.media ? (
        <div className="absolute inset-0 overflow-hidden">
          <div className="size-full origin-center transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none">
            <DoorMedia media={block.media} title={block.title} />
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 bg-secondary" />
      )}

      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/15",
          "transition-colors duration-500 group-hover:from-black/70 group-hover:via-black/35",
          "motion-reduce:transition-none",
        )}
      />

      <div className="relative z-10 mt-auto flex w-full flex-col justify-end p-5 sm:p-6">
        {block.title && (
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-neutral-50 sm:text-3xl">
            {block.title}
          </h2>
        )}
        {block.cta?.label ? (
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-50">
            {block.cta.label}
            <span
              aria-hidden="true"
              className="ml-2 inline-block transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transform-none"
            >
              →
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );

  if (!block.cta) return inner;

  return (
    <a
      href={block.cta.href}
      {...(block.cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="block h-full rounded-[1.35rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {inner}
    </a>
  );
}
