import { useState } from "react";

import type { PublicLanding } from "@/lib/website.server";

/**
 * The site entry screen: one full-bleed visual, the brand wording and a single
 * way in. The fallback image is the video's poster, so it is what a visitor
 * sees while the video loads, when playback is blocked, or when it fails.
 */
export function LandingScreen({ landing }: { landing: PublicLanding }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const showVideo = Boolean(landing.video_url) && !videoFailed;

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-neutral-950 text-neutral-50">
      {landing.image_url && (
        <img
          src={landing.image_url}
          alt={landing.image_alt ?? ""}
          className="absolute inset-0 size-full object-cover"
          fetchPriority="high"
        />
      )}

      {showVideo && (
        <video
          key={landing.video_url}
          className="absolute inset-0 size-full object-cover"
          src={landing.video_url ?? undefined}
          poster={landing.image_url ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
          onError={() => setVideoFailed(true)}
        />
      )}

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/80"
      />

      <main className="relative flex min-h-[100svh] flex-col items-center justify-center gap-8 px-6 py-16 text-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold uppercase leading-[1.05] tracking-[0.14em] drop-shadow-sm sm:text-6xl lg:text-7xl">
            {landing.title ?? "West Java Riders"}
          </h1>
          {landing.subtitle && (
            <p className="mx-auto max-w-2xl text-xs uppercase tracking-[0.32em] text-neutral-200 sm:text-sm">
              {landing.subtitle}
            </p>
          )}
        </div>

        {landing.cta && (
          <a
            href={landing.cta.href}
            {...(landing.cta.external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className={ctaClass}
          >
            {landing.cta.label}
          </a>
        )}
      </main>
    </div>
  );
}

const ctaClass =
  "inline-flex min-h-12 items-center justify-center rounded-full border border-neutral-50/80 px-7 py-3 text-xs font-semibold uppercase tracking-[0.22em] transition-colors hover:bg-neutral-50 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-50 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 sm:text-sm";
