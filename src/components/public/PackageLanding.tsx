import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

type PackageLandingProps = {
  productId: string;
  title: string;
  summary: string | null;
  body: string | null;
  imageUrl: string | null;
};

function ConfigureCta({ productId }: { productId: string }) {
  return (
    <Button asChild size="lg" className="h-12 px-6 text-sm font-medium tracking-wide">
      <Link to="/build-your-trip/$productId/configure" params={{ productId }}>
        Configure this trip
        <span aria-hidden="true" className="ml-2">
          →
        </span>
      </Link>
    </Button>
  );
}

/** Informational screen before the configurator. Does not start a draft. */
export function PackageLanding({ productId, title, summary, body, imageUrl }: PackageLandingProps) {
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/build-your-trip"
        className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
      >
        ← Back
      </Link>

      {imageUrl && (
        <div className="mt-8 overflow-hidden rounded-lg sm:mt-10">
          <img
            src={imageUrl}
            alt={title}
            className="aspect-[4/5] w-full object-cover sm:aspect-[16/10]"
          />
        </div>
      )}

      <header className={`${imageUrl ? "mt-8" : "mt-10 sm:mt-14"} space-y-5`}>
        <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {summary && (
          <p className="max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            {summary}
          </p>
        )}
        <div>
          <ConfigureCta productId={productId} />
        </div>
      </header>

      {body && (
        <>
          <section className="mt-16 space-y-4 sm:mt-20">
            <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              About this trip
            </h2>
            <p className="whitespace-pre-line text-base leading-relaxed text-foreground/90">
              {body}
            </p>
          </section>
          <div className="mt-12 sm:mt-16">
            <ConfigureCta productId={productId} />
          </div>
        </>
      )}
    </div>
  );
}
