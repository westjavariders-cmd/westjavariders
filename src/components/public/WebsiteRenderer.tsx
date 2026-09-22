/**
 * Public renderer for the Website Configuration Layer.
 *
 * It only presents configured content: it never prices anything, never
 * creates packages and never changes the cart. Product buttons hand off to
 * the existing Build your trip flow.
 */
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DoorCard } from "@/components/public/DoorCard";
import { ProductCard } from "@/components/public/ProductCard";
import { cn } from "@/lib/utils";
import { HOME_SLUG } from "@/lib/website";
import type { PublicBlock, PublicSection, PublicWebsitePage } from "@/lib/website.server";

function Cta({ cta }: { cta: NonNullable<PublicBlock["cta"]> }) {
  if (cta.external) {
    return (
      <Button asChild variant="outline" size="sm">
        <a href={cta.href} target="_blank" rel="noopener noreferrer">
          {cta.label}
        </a>
      </Button>
    );
  }
  return (
    <Button asChild size="sm">
      <a href={cta.href}>{cta.label}</a>
    </Button>
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
        className="w-full rounded-lg border border-border/60"
      />
    );
  }
  return (
    <img
      src={media.url}
      alt=""
      loading="lazy"
      className="aspect-[16/9] w-full rounded-lg border border-border/60 object-cover"
    />
  );
}

function ProductList({ products }: { products: PublicBlock["products"] }) {
  if (products.length === 0) return null;
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
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
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <Link
          key={`${item.catalogue_id}-${item.item_id}`}
          to="/book/$catalogueId/$itemId"
          params={{ catalogueId: item.catalogue_id, itemId: item.item_id }}
          className="block"
        >
          <Card className="h-full transition-colors hover:border-primary">
            <CardContent className="space-y-2 p-4">
              {item.photo_url && (
                <img
                  src={item.photo_url}
                  alt={item.name}
                  loading="lazy"
                  className="aspect-[16/9] w-full rounded-md object-cover"
                />
              )}
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {item.catalogue_name}
              </p>
              <h3 className="text-base font-medium">{item.name}</h3>
              {item.description && (
                <p className="text-sm text-muted-foreground">{item.description}</p>
              )}
              {item.from_price_idr != null && (
                <p className="text-sm font-semibold">
                  From{" "}
                  {new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    maximumFractionDigits: 0,
                  }).format(item.from_price_idr)}
                </p>
              )}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function homeDoorsLayoutClass(count: number) {
  return cn(
    "mx-auto grid max-w-6xl gap-3 md:gap-4",
    "grid-cols-1",
    count === 2 && "md:grid-cols-2",
    count === 3 && "md:grid-cols-2 lg:grid-cols-3",
    count === 4 && "md:grid-cols-2",
    count === 5 && "md:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2",
    count >= 6 && "md:grid-cols-2 lg:grid-cols-3",
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

function Block({ block }: { block: PublicBlock }) {
  const heading =
    block.kind === "hero" ? (
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{block.title}</h2>
    ) : (
      <h2 className="text-lg font-medium tracking-tight">{block.title}</h2>
    );

  return (
    <div className="space-y-3">
      {block.media &&
        (block.kind === "hero" || block.kind === "image_text" || block.kind === "video") && (
          <Media media={block.media} />
        )}
      {block.title && heading}
      {block.body && (
        <p className="whitespace-pre-line text-sm text-muted-foreground">{block.body}</p>
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
    <section className="space-y-6">
      {(section.title || section.subtitle) && (
        <div className="mx-auto max-w-3xl">
          {section.title && (
            <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
          )}
          {section.subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{section.subtitle}</p>
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
            const wide = block.kind === "product_selection" || block.kind === "people";
            return (
              <div
                key={block.id}
                className={wide ? "mx-auto w-full max-w-6xl" : "mx-auto max-w-3xl"}
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
    <div className="space-y-14 py-2 sm:py-4">
      {showHeading && (page.title || page.subtitle) && (
        <header className="mx-auto max-w-3xl space-y-2">
          {page.title && (
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{page.title}</h1>
          )}
          {page.subtitle && <p className="text-sm text-muted-foreground">{page.subtitle}</p>}
        </header>
      )}
      {page.sections.map((section) => (
        <Section key={section.id} section={section} doorLayout={doorLayout} />
      ))}
    </div>
  );
}
