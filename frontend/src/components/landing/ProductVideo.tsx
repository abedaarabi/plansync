"use client";

import Image from "next/image";
import { Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/** Virtual player size — YouTube ABR keys off iframe CSS size, not the scaled visual. */
const HD_EMBED_WIDTH = 1920;
const HD_EMBED_HEIGHT = 1080;

export type ProductVideoProps = {
  title: string;
  /** Accessible label for the play control. */
  playAriaLabel: string;
  thumbnail: string;
  thumbnailAlt: string;
  youtubeId?: string;
  /** Local sources — used when `youtubeId` is omitted. */
  sources?: { src: string; type: string }[];
  /** Prefer loading the poster early when this block is near the fold. */
  posterPriority?: boolean;
  className?: string;
  /** Optional caption under the frame. */
  caption?: string;
};

function youtubeEmbedSrc(videoId: string, autoplay: boolean) {
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    mute: "0",
    controls: "1",
    modestbranding: "1",
    rel: "0",
    iv_load_policy: "3",
    playsinline: "1",
    fs: "1",
    cc_load_policy: "0",
    color: "white",
    vq: "hd1080",
    hd: "1",
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

function warmYoutubeConnections() {
  if (typeof document === "undefined") return;
  if (document.querySelector('link[data-yt-preconnect="1"]')) return;
  for (const href of ["https://www.youtube-nocookie.com", "https://i.ytimg.com"]) {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    link.setAttribute("data-yt-preconnect", "1");
    document.head.appendChild(link);
  }
}

function useHdEmbedScale(containerRef: RefObject<HTMLElement | null>, active: boolean) {
  const [scale, setScale] = useState(0);

  useEffect(() => {
    if (!active) return;
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const width = el.clientWidth;
      setScale(width > 0 ? width / HD_EMBED_WIDTH : 0);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef, active]);

  return scale;
}

/**
 * Premium product video frame: poster + custom play, then inline playback in place.
 * No modal — the page scroll position is preserved. No rounded frame corners.
 */
// fallow-ignore-next-line complexity
export function ProductVideo({
  title,
  playAriaLabel,
  thumbnail,
  thumbnailAlt,
  youtubeId,
  sources,
  posterPriority = false,
  className = "",
  caption,
}: ProductVideoProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [activated, setActivated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const scale = useHdEmbedScale(containerRef, activated && Boolean(youtubeId));

  const isRemotePoster = thumbnail.startsWith("http");
  const useLocalVideo = !youtubeId && Boolean(sources?.length);

  const play = useCallback(() => {
    if (youtubeId) warmYoutubeConnections();
    setActivated(true);
  }, [youtubeId]);

  useEffect(() => {
    if (!activated || !useLocalVideo) return;
    const video = localVideoRef.current;
    if (!video) return;
    void video.play().catch(() => {
      /* autoplay may be blocked; controls remain available */
    });
  }, [activated, useLocalVideo]);

  const motionClass = prefersReducedMotion
    ? ""
    : "transition duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:group-hover:scale-[1.015]";

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className={`group relative aspect-video w-full overflow-hidden border border-slate-200/80 bg-slate-950 shadow-[0_20px_60px_-28px_rgba(15,23,42,0.35),0_0_0_1px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/4 ${
          prefersReducedMotion
            ? ""
            : "transition duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:hover:shadow-[0_28px_70px_-30px_rgba(15,23,42,0.4)]"
        }`}
      >
        {activated && youtubeId && scale > 0 ? (
          <iframe
            src={youtubeEmbedSrc(youtubeId, true)}
            title={title}
            width={HD_EMBED_WIDTH}
            height={HD_EMBED_HEIGHT}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute left-0 top-0 max-w-none border-0"
            style={{
              width: HD_EMBED_WIDTH,
              height: HD_EMBED_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          />
        ) : null}

        {activated && useLocalVideo && sources ? (
          <video
            ref={localVideoRef}
            className="absolute inset-0 h-full w-full object-cover"
            controls
            playsInline
            preload="metadata"
            poster={thumbnail}
          >
            {sources.map((source) => (
              <source key={source.src} src={source.src} type={source.type} />
            ))}
          </video>
        ) : null}

        {!activated ? (
          <button
            type="button"
            onClick={play}
            onPointerEnter={youtubeId ? warmYoutubeConnections : undefined}
            onFocus={youtubeId ? warmYoutubeConnections : undefined}
            className="absolute inset-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-cta) focus-visible:ring-inset"
            aria-label={playAriaLabel}
          >
            <Image
              src={thumbnail}
              alt={thumbnailAlt}
              fill
              className={`object-cover object-center ${motionClass}`}
              sizes="(max-width: 768px) 100vw, min(1320px, 92vw)"
              priority={posterPriority}
              loading={posterPriority ? undefined : "lazy"}
              unoptimized={isRemotePoster}
              quality={isRemotePoster ? undefined : 82}
            />

            <span
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.12)_0%,rgba(15,23,42,0.28)_45%,rgba(2,6,23,0.55)_100%)] transition duration-500 group-hover:bg-[linear-gradient(180deg,rgba(15,23,42,0.18)_0%,rgba(15,23,42,0.36)_50%,rgba(2,6,23,0.62)_100%)]"
              aria-hidden
            />

            <span className="pointer-events-none absolute inset-x-0 bottom-0 p-5 sm:p-7 md:p-8">
              <span className="block max-w-xl text-left text-sm font-semibold tracking-tight text-white sm:text-base">
                {title}
              </span>
            </span>

            <span className="relative z-10 inline-flex items-center justify-center">
              <span
                className={`relative inline-flex h-14 w-14 items-center justify-center sm:h-16 sm:w-16 md:h-18 md:w-18 ${
                  prefersReducedMotion
                    ? ""
                    : "transition duration-300 ease-out motion-safe:group-hover:scale-[1.08] motion-safe:group-active:scale-[0.96]"
                }`}
              >
                <span
                  className="absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--landing-cta)_22%,transparent)] blur-md"
                  aria-hidden
                />
                <span className="relative inline-flex h-full w-full items-center justify-center rounded-full bg-(--landing-cta) shadow-[0_14px_36px_-14px_color-mix(in_srgb,var(--landing-cta)_75%,transparent)] ring-1 ring-white/25 transition duration-300 group-hover:bg-(--landing-cta-bright)">
                  <Play
                    className="h-6 w-6 translate-x-px text-(--landing-cta-text) sm:h-7 sm:w-7 md:h-8 md:w-8"
                    fill="currentColor"
                    aria-hidden
                  />
                </span>
              </span>
            </span>
          </button>
        ) : null}
      </div>

      {caption ? (
        <p className="landing-type-caption mt-3 text-center text-slate-500">{caption}</p>
      ) : null}
    </div>
  );
}
