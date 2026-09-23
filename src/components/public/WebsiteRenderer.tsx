/**
 * Public renderer for the Website Configuration Layer.
 *
 * It only presents configured content: it never prices anything, never
 * creates packages and never changes the cart. Product buttons hand off to
 * the existing Build your trip flow.
 */
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { DoorCard } from "@/components/public/DoorCard";
import { ProductCard } from "@/components/public/ProductCard";
import { cn } from "@/lib/utils";
import { HOME_SLUG } from "@/lib/website";
import type { PublicBlock, PublicSection, PublicWebsitePage } from "@/lib/website.server";

function Cta({ cta }: { cta: NonNullable<PublicBlock["cta"]> }) {
  const className = "cbr-editorial-cta";
  if (cta.external) {
    return (
      <a href={cta.href} target="_blank" rel="noopener noreferrer" className={className}>
        {cta.label}
        <span aria-hidden="true">→</span>
      </a>
    );
  }
  return (
    <a href={cta.href} className={className}>
      {cta.label}
      <span aria-hidden="true">→</span>
    </a>
  );
}

function Media({ media }: { media: NonNullable<PublicBlock["media"]> }) {
  if (media.kind === "video") {
    return (
      <video
        src={media.url}
        controls
        playsInline
        preload="metadata"
        className="aspect-[16/9] w-full bg-secondary object-cover object-center"
      />
    );
  }
  return (
    <img
      src={media.url}
      alt=""
      loading="lazy"
      className="aspect-[16/10] w-full bg-secondary object-cover object-center sm:aspect-[16/9]"
    />
  );
}

function ProductList({ products }: { products: PublicBlock["products"] }) {
  if (products.length === 0) return null;
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:gap-6">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          productId={product.id}
          title={product.title}
          summary={product.summary}
          imageUrl={product.image_url}
          bookable={product.bookable}
        />
      ))}
    </div>
  );
}

function CatalogueList({ items }: { items: PublicBlock["catalogue_items"] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
      {items.map((item) => (
        <Link
          key={`${item.catalogue_id}-${item.item_id}`}
          to="/book/$catalogueId/$itemId"
          params={{ catalogueId: item.catalogue_id, itemId: item.item_id }}
          className="group relative isolate flex min-h-[52vw] overflow-hidden bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-[18rem] md:min-h-[20rem]"
        >
          {item.photo_url ? (
            <div className="absolute inset-0 overflow-hidden">
              <div className="size-full origin-center transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none">
                <img
                  src={item.photo_url}
                  alt={item.name}
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
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-200/80">
              {item.catalogue_name}
            </p>
            <h3 className="text-balance text-2xl font-semibold tracking-tight text-neutral-50">
              {item.name}
            </h3>
            {item.description && (
              <p className="max-w-md line-clamp-2 text-sm leading-relaxed text-neutral-200/90">
                {item.description}
              </p>
            )}
            {item.from_price_idr != null && (
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-50">
                From{" "}
                {new Intl.NumberFormat("id-ID", {
                  style: "currency",
                  currency: "IDR",
                  maximumFractionDigits: 0,
                }).format(item.from_price_idr)}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

function homeDoorsLayoutClass(count: number) {
  return cn(
    "mx-auto grid max-w-[90rem] gap-3 md:gap-4 xl:gap-5",
    "grid-cols-1",
    count === 2 && "md:grid-cols-2",
    count === 3 && "md:grid-cols-2",
    count === 4 && "md:grid-cols-2",
    count === 5 && "md:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2",
    count === 6 && "md:grid-cols-2 lg:grid-cols-3",
    count >= 7 && "md:grid-cols-2",
  );
}

function internalDoorsLayoutClass(count: number) {
  return cn(
    "mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 md:grid-cols-2 md:gap-5",
    count >= 3 && "lg:grid-cols-3",
  );
}

function homeDoorPlacementClass(index: number, count: number) {
  if (count === 5 && index === 0) return "md:col-span-2 lg:col-span-2 lg:row-span-2";
  if (count >= 7 && index === 0) return "lg:col-span-2";
  return undefined;
}

function isHomeFeaturedDoor(index: number, count: number) {
  return index === 0 && (count === 5 || count >= 7);
}

function BlockCopy({
  block,
  heading,
}: {
  block: PublicBlock;
  heading: ReactNode;
}) {
  return (
    <>
      {block.title && heading}
      {block.body && (
        <p className="max-w-2xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground sm:text-base">
          {block.body}
        </p>
      )}
      {block.kind === "product_selection" && <ProductList products={block.products} />}
      {block.kind === "people" && block.products.length > 0 && (
        <ProductList products={block.products} />
      )}
      {block.kind === "catalogue" && <CatalogueList items={block.catalogue_items} />}
      {block.cta?.label && (
        <div>
          <Cta cta={block.cta} />
        </div>
      )}
    </>
  );
}

function Block({ block }: { block: PublicBlock }) {
  const heading =
    block.kind === "hero" ? (
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">{block.title}</h2>
    ) : (
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{block.title}</h2>
    );

  if (block.kind === "image_text" && block.media) {
    return (
      <div className="grid gap-6 md:gap-8 lg:grid-cols-12 lg:items-center lg:gap-12">
        <div className="lg:col-span-7">
          <Media media={block.media} />
        </div>
        <div className="space-y-4 lg:col-span-5">
          <BlockCopy block={block} heading={heading} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {block.media && (block.kind === "hero" || block.kind === "video") && (
        <Media media={block.media} />
      )}
      <BlockCopy block={block} heading={heading} />
    </div>
  );
}

function Section({
  section,
  doorLayout,
}: {
  section: PublicSection;
  doorLayout: "mosaic" | "selection";
}) {
  const doors = section.blocks.filter((b) => b.kind === "door");
  const others = section.blocks.filter((b) => b.kind !== "door");
  const isHomeMosaic = doorLayout === "mosaic";

  return (
    <section className="space-y-4 sm:space-y-5">
      {(section.title || section.subtitle) && (
        <div className="mx-auto max-w-6xl">
          {section.title && (
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{section.title}</h2>
          )}
          {section.subtitle && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {section.subtitle}
            </p>
          )}
        </div>
      )}

      {doors.length > 0 && (
        <div
          className={
            isHomeMosaic
              ? homeDoorsLayoutClass(doors.length)
              : internalDoorsLayoutClass(doors.length)
          }
        >
          {doors.map((block, index) => (
            <div
              key={block.id}
              className={cn(
                "h-full",
                isHomeMosaic ? homeDoorPlacementClass(index, doors.length) : undefined,
              )}
            >
              <DoorCard
                block={block}
                layout={doorLayout}
                featured={isHomeMosaic && isHomeFeaturedDoor(index, doors.length)}
              />
            </div>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-8">
          {others.map((block) => {
            const wide =
              block.kind === "product_selection" ||
              block.kind === "people" ||
              block.kind === "catalogue" ||
              block.kind === "hero" ||
              block.kind === "image_text" ||
              block.kind === "video";
            return (
              <div
                key={block.id}
                className={wide ? "mx-auto w-full max-w-[90rem]" : "mx-auto max-w-3xl"}
              >
                <Block block={block} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function WebsiteRenderer({
  page,
  showHeading = true,
}: {
  page: PublicWebsitePage;
  showHeading?: boolean;
}) {
  const doorLayout = page.slug === HOME_SLUG ? "mosaic" : "selection";

  return (
    <div className="space-y-10 py-0 sm:space-y-14 sm:py-1">
      {showHeading && (page.title || page.subtitle) && (
        <header className="mx-auto max-w-6xl space-y-3">
          {page.title && (
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
              {page.title}
            </h1>
          )}
          {page.subtitle && (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {page.subtitle}
            </p>
          )}
        </header>
      )}
      {page.sections.map((section) => (
        <Section key={section.id} section={section} doorLayout={doorLayout} />
      ))}
    </div>
  );
}
