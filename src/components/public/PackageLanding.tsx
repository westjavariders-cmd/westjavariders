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
      className="inline-flex min-h-12 items-center justify-center gap-2 border border-foreground bg-foreground px-6 text-[11px] font-medium uppercase tracking-[0.18em] text-background transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      Configure this trip
      <span aria-hidden="true">→</span>
    </Link>
  );
}

/** Informational screen before the configurator. Does not start a draft. */
export function PackageLanding({ productId, title, summary, body, imageUrl }: PackageLandingProps) {
  return (
    <div className="mx-auto w-full max-w-[90rem]">
      <Link to="/home" className="cbr-editorial-cta text-muted-foreground">
        ← Back
      </Link>

      <div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-12 lg:items-end lg:gap-12 xl:gap-16">
        {imageUrl ? (
          <div className="relative isolate overflow-hidden bg-secondary lg:col-span-7">
            <img
              src={imageUrl}
              alt={title}
              className="aspect-[4/5] w-full object-cover object-center sm:aspect-[16/10] lg:aspect-auto lg:h-[min(70svh,44rem)] lg:min-h-[36rem]"
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
