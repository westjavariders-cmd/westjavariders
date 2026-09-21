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
    <div className="mt-4 space-y-3">
      {products.map((product) =>
        product.bookable ? (
          <Link
            key={product.id}
            to="/build-your-trip/$productId"
            params={{ productId: product.id }}
            className="block"
          >
            <Card className="transition-colors hover:border-primary">
              <CardContent className="p-4">
                <h3 className="text-base font-medium">{product.title}</h3>
                {product.summary && (
                  <p className="mt-1 text-sm text-muted-foreground">{product.summary}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card key={product.id} className="opacity-70">
            <CardContent className="p-4">
              <h3 className="text-base font-medium">{product.title}</h3>
              {product.summary && (
                <p className="mt-1 text-sm text-muted-foreground">{product.summary}</p>
              )}
              <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                Not available for booking right now
              </p>
            </CardContent>
          </Card>
        ),
      )}
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

function Block({ block }: { block: PublicBlock }) {
  const heading =
    block.kind === "hero" ? (
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{block.title}</h2>
    ) : (
      <h2 className="text-lg font-medium tracking-tight">{block.title}</h2>
    );

  if (block.kind === "door") {
    const inner = (
      <Card className="h-full transition-colors hover:border-primary">
        <CardContent className="p-4">
          {block.media && <Media media={block.media} />}
          {block.title && (
            <h2 className="mt-3 text-base font-semibold tracking-tight">{block.title}</h2>
          )}
          {block.body && <p className="mt-1 text-sm text-muted-foreground">{block.body}</p>}
          {block.cta?.label && (
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em]">
              {block.cta.label}
            </p>
          )}
        </CardContent>
      </Card>
    );
    if (!block.cta) return inner;
    return block.cta.external ? (
      <a href={block.cta.href} target="_blank" rel="noopener noreferrer" className="block">
        {inner}
      </a>
    ) : (
      <a href={block.cta.href} className="block">
        {inner}
      </a>
    );
  }

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

function Section({ section }: { section: PublicSection }) {
  const doors = section.blocks.filter((b) => b.kind === "door");
  const others = section.blocks.filter((b) => b.kind !== "door");

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
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {doors.map((block) => (
            <Block key={block.id} block={block} />
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="mx-auto max-w-3xl space-y-8">
          {others.map((block) => (
            <Block key={block.id} block={block} />
          ))}
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
        <Section key={section.id} section={section} />
      ))}
    </div>
  );
}
