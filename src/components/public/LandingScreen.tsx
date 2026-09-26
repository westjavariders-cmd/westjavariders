import { useEffect, useRef, useState } from "react";

import type { PublicLanding } from "@/lib/website.server";
import { cn } from "@/lib/utils";

/**
 * Site entry: one full-bleed visual and a single CMS-configured way in.
 * The still sits under the video so a failed or blocked playback never
 * drops to a black frame.
 */
export function LandingScreen({ landing }: { landing: PublicLanding }) {
  const reducedMotion = usePrefersReducedMotion();
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const hasImage = Boolean(landing.image_url);
  const hasVideo = Boolean(landing.video_url);
  const playVideo = hasVideo && reducedMotion === false && !videoFailed;
  const showPausedVideo = hasVideo && reducedMotion === true && !hasImage && !videoFailed;
  const waitingOnPreference = hasVideo && reducedMotion === null && !videoFailed;
  const hasLiveMedia = hasImage || playVideo || showPausedVideo || waitingOnPreference;
  const videoVisible = playVideo ? videoPlaying : showPausedVideo;

  useEffect(() => {
    setVideoFailed(false);
    setVideoPlaying(false);
  }, [landing.video_url, reducedMotion]);

  useEffect(() => {
    if (!playVideo) return;
    const node = videoRef.current;
    if (!node) return;
    const attempt = node.play();
    if (attempt !== undefined) {
      void attempt.catch(() => {
        setVideoFailed(true);
        setVideoPlaying(false);
      });
    }
  }, [playVideo, landing.video_url]);

  return (
    <div className="public-theme relative isolate h-[100svh] w-full overflow-x-hidden overflow-y-hidden text-neutral-50">
      {hasLiveMedia ? (
        <>
          {hasImage ? (
            <img
              src={landing.image_url ?? undefined}
              alt={landing.image_alt ?? ""}
              className="absolute inset-0 size-full object-cover"
              fetchPriority="high"
            />
          ) : (
            <div aria-hidden="true" className="absolute inset-0 bg-neutral-900" />
          )}
          {(playVideo || showPausedVideo) && (
            <video
              ref={videoRef}
              key={`${landing.video_url ?? ""}-${playVideo ? "live" : "still"}`}
              className={cn(
                "absolute inset-0 size-full object-cover",
                playVideo && "transition-opacity duration-700",
                videoVisible ? "opacity-100" : "opacity-0",
              )}
              src={landing.video_url ?? undefined}
              poster={landing.image_url ?? undefined}
              autoPlay={playVideo}
              muted
              loop={playVideo}
              playsInline
              preload={showPausedVideo ? "auto" : "metadata"}
              aria-hidden="true"
              tabIndex={-1}
              onPlaying={() => {
                if (playVideo) setVideoPlaying(true);
              }}
              onLoadedData={() => {
                if (showPausedVideo) {
                  const node = videoRef.current;
                  if (node) node.pause();
                }
              }}
              onError={() => {
                setVideoFailed(true);
                setVideoPlaying(false);
              }}
            />
          )}
        </>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(120%_90%_at_12%_8%,rgba(115,115,115,0.28),transparent_52%),linear-gradient(165deg,rgb(28,28,28)_0%,rgb(12,12,12)_48%,rgb(8,8,8)_100%)]"
        />
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.45)_38%,rgba(0,0,0,0.18)_62%,rgba(0,0,0,0.28)_100%)]"
      />

      <main className="relative flex h-full min-h-[100svh] flex-col justify-end px-5 pb-[max(2.75rem,env(safe-area-inset-bottom))] pt-16 sm:px-10 sm:pb-16 lg:px-16 lg:pb-20">
        <div className="flex w-full max-w-2xl flex-col items-start gap-6 sm:max-w-3xl sm:gap-8">
          <div className="space-y-3 sm:space-y-4">
            {landing.title && (
              <h1 className="text-balance text-[2.125rem] font-semibold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
                {landing.title}
              </h1>
            )}
            {landing.subtitle && (
              <p className="max-w-xl text-pretty text-sm leading-relaxed text-neutral-200/90 sm:text-base">
                {landing.subtitle}
              </p>
            )}
          </div>

          {landing.cta && (
            <a
              href={landing.cta.href}
              {...(landing.cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="inline-flex min-h-12 min-w-[2.75rem] items-center justify-center gap-2 rounded-md border border-neutral-50 bg-neutral-50 px-6 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-950 transition-colors duration-150 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-50 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 sm:text-xs"
            >
              {landing.cta.label}
              <span aria-hidden="true">→</span>
            </a>
          )}
        </div>
        <p className="mt-10 text-[11px] text-neutral-200/65">Services offered by Cimaja Boardriders</p>
      </main>
    </div>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return reduced;
}
