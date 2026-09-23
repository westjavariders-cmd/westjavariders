import { Link } from "@tanstack/react-router";

type PackageLandingProps = {
  productId: string;
  title: string;
  summary: string | null;
  body: string | null;
  imageUrl: string | null;
};

function ConfigureCta({ productId }: { productId: string }) {
  return (
    <Link
      to="/build-your-trip/$productId/configure"
      params={{ productId }}
      className="cbr-editorial-cta"
    >
      Configure this trip
      <span aria-hidden="true">→</span>
    </Link>
  );
}

/** Informational screen before the configurator. Does not start a draft. */
export function PackageLanding({ productId, title, summary, body, imageUrl }: PackageLandingProps) {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <Link to="/build-your-trip" className="cbr-editorial-cta text-muted-foreground">
        ← Back
      </Link>

      <div className="mt-8 grid gap-8 lg:mt-12 lg:grid-cols-12 lg:items-end lg:gap-12">
        {imageUrl ? (
          <div className="relative isolate overflow-hidden bg-secondary lg:col-span-7">
            <img
              src={imageUrl}
              alt={title}
              className="aspect-[4/5] w-full object-cover object-center sm:aspect-[16/10] lg:aspect-[4/5] lg:min-h-[32rem]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent lg:from-black/10"
            />
          </div>
        ) : null}

        <header
          className={
            imageUrl ? "space-y-5 lg:col-span-5 lg:pb-2" : "mt-4 space-y-5 lg:col-span-8 lg:mt-8"
          }
        >
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
      </div>

      {body && (
        <>
          <section className="mt-16 max-w-2xl space-y-4 sm:mt-20 lg:mt-24">
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
