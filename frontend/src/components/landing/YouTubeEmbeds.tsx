"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type RefObject } from "react";
import { FileStack, Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Virtual player size — YouTube ABR keys off iframe CSS size, not the scaled visual. */
const HD_EMBED_WIDTH = 1920;
const HD_EMBED_HEIGHT = 1080;

type LandingVideoModalProps = {
  videoId: string;
  thumbnail?: string;
  title?: string;
  className?: string;
  playAriaLabel?: string;
  posterAlt?: string;
  posterPriority?: boolean;
  thumbnailMode?: "image" | "icon";
  thumbnailLabel?: string;
  thumbnailIcon?: LucideIcon;
  thumbnailBadgeClassName?: string;
};

function youtubeEmbedSrc(
  videoId: string,
  {
    autoplay = false,
    mute = false,
    loop = false,
    controls = true,
  }: {
    autoplay?: boolean;
    mute?: boolean;
    loop?: boolean;
    controls?: boolean;
  } = {},
) {
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    mute: mute ? "1" : "0",
    controls: controls ? "1" : "0",
    modestbranding: "1",
    rel: "0",
    iv_load_policy: "3",
    playsinline: "1",
    disablekb: controls ? "0" : "1",
    fs: "0",
    cc_load_policy: "0",
    color: "white",
    vq: "hd1080",
    hd: "1",
  });
  if (loop) {
    params.set("loop", "1");
    params.set("playlist", videoId);
  }
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

/** Scale a 1080p-sized iframe down into the container so YouTube still serves HD. */
function useHdEmbedScale(containerRef: RefObject<HTMLElement | null>) {
  const [scale, setScale] = useState(0);

  useEffect(() => {
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
  }, [containerRef]);

  return scale;
}

export function LandingVideoModal({
  videoId,
  thumbnail,
  title = "Video",
  className = "",
  playAriaLabel,
  posterAlt,
  posterPriority = false,
  thumbnailMode = "image",
  thumbnailLabel,
  thumbnailIcon: ThumbnailIcon = FileStack,
  thumbnailBadgeClassName = "",
}: LandingVideoModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadVideo, setLoadVideo] = useState(false);

  const thumbnailUrl = thumbnail ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  const openModal = () => {
    setIsOpen(true);
    window.setTimeout(() => setLoadVideo(true), 120);
  };

  const closeModal = () => {
    setIsOpen(false);
    setLoadVideo(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onEsc);
    document.body.classList.add("overflow-hidden");
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.classList.remove("overflow-hidden");
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={`group relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-950 shadow-[0_22px_55px_-30px_rgba(15,23,42,0.45)] transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/85 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${className}`}
        aria-label={playAriaLabel ?? `Play ${title}`}
      >
        {thumbnailMode === "icon" ? (
          <span className="absolute inset-0">
            <span className="absolute inset-0 bg-linear-to-br from-indigo-700 via-indigo-600 to-slate-900 transition duration-500 ease-out group-hover:scale-[1.03]" />
            <span className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25)_0%,transparent_42%),radial-gradient(circle_at_80%_90%,rgba(99,102,241,0.35)_0%,transparent_38%)]" />
            <span className="absolute inset-x-4 top-4 sm:inset-x-6 sm:top-6">
              <span
                className={`inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm sm:text-xs ${thumbnailBadgeClassName}`}
              >
                <ThumbnailIcon className="h-3.5 w-3.5" />
                {thumbnailLabel ?? "Revision history"}
              </span>
            </span>
          </span>
        ) : (
          <Image
            src={thumbnailUrl}
            alt={posterAlt ?? `${title} thumbnail`}
            fill
            className="object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
            priority={posterPriority}
            loading={posterPriority ? undefined : "lazy"}
            fetchPriority={posterPriority ? "high" : undefined}
            sizes="(max-width: 1024px) 100vw, 50vw"
            unoptimized
          />
        )}
        <span
          className="pointer-events-none absolute inset-0 bg-slate-900/30 transition duration-300 group-hover:bg-slate-900/45"
          aria-hidden
        />
        <span className="relative z-10 inline-flex h-16 w-16 items-center justify-center sm:h-18 sm:w-18">
          <span
            className="absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--landing-cta)_30%,transparent)] blur-md transition duration-300 motion-safe:animate-pulse group-hover:bg-[color-mix(in_srgb,var(--landing-cta)_40%,transparent)]"
            aria-hidden
          />
          <span
            className="absolute inset-0 rounded-full border border-[color-mix(in_srgb,var(--landing-cta)_65%,white_35%)] motion-safe:animate-ping"
            aria-hidden
          />
          <span className="relative inline-flex h-full w-full items-center justify-center rounded-full bg-(--landing-cta) shadow-[0_16px_44px_-20px_color-mix(in_srgb,var(--landing-cta)_70%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--landing-cta)_35%,white_65%)] transition duration-300 group-hover:scale-105 group-hover:bg-(--landing-cta-bright)">
            <Play
              className="h-7 w-7 translate-x-px text-(--landing-cta-text) sm:h-8 sm:w-8"
              fill="currentColor"
            />
          </span>
        </span>
      </button>

      <div
        className={`mobile-sheet-host fixed inset-0 z-50 flex items-center justify-center p-4 transition duration-300 max-lg:items-end max-lg:p-0 sm:p-6 ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!isOpen}
      >
        <button
          type="button"
          onClick={closeModal}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
          aria-label="Close video"
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={`relative z-10 w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_40px_100px_-32px_rgba(2,6,23,0.95)] transition duration-300 ${
            isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={closeModal}
            className="absolute right-3 top-3 z-20 rounded-full bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-900 transition hover:bg-white"
            aria-label="Close modal"
          >
            Close
          </button>
          <div className="relative aspect-video w-full bg-black">
            {loadVideo ? (
              <iframe
                src={youtubeEmbedSrc(videoId, { autoplay: true, controls: true })}
                title={title}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
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

type LandingYoutubeFacadeProps = {
  videoId: string;
  title: string;
  playAriaLabel: string;
  posterAlt: string;
  /** Branded local poster — preferred over the default YouTube thumbnail. */
  posterSrc?: string;
  /** Stable id so section CTAs can trigger play. */
  playButtonId?: string;
};

/**
 * Lite-YouTube facade: poster only until click — no YouTube network until play.
 * Best practice for below-the-fold landing embeds (keeps LCP/TBT light).
 */
export function LandingYoutubeFacade({
  videoId,
  title,
  playAriaLabel,
  posterAlt,
  posterSrc,
  playButtonId,
}: LandingYoutubeFacadeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activated, setActivated] = useState(false);
  const scale = useHdEmbedScale(containerRef);
  const thumbnailUrl = posterSrc ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const isRemotePoster = thumbnailUrl.startsWith("http");

  return (
    <div ref={containerRef} className="relative aspect-video overflow-hidden bg-slate-950">
      {activated && scale > 0 ? (
        <iframe
          src={youtubeEmbedSrc(videoId, {
            autoplay: true,
            mute: false,
            controls: true,
          })}
          title={title}
          width={HD_EMBED_WIDTH}
          height={HD_EMBED_HEIGHT}
          allow="autoplay; encrypted-media; picture-in-picture"
          className="absolute left-0 top-0 max-w-none border-0"
          style={{
            width: HD_EMBED_WIDTH,
            height: HD_EMBED_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      ) : (
        <button
          type="button"
          id={playButtonId}
          onClick={() => setActivated(true)}
          onPointerEnter={warmYoutubeConnections}
          onFocus={warmYoutubeConnections}
          className="group absolute inset-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-cta) focus-visible:ring-inset"
          aria-label={playAriaLabel}
        >
          <Image
            src={thumbnailUrl}
            alt={posterAlt}
            fill
            className="object-cover transition duration-500 ease-out group-hover:scale-[1.02]"
            sizes="(max-width: 1024px) 100vw, 60vw"
            unoptimized={isRemotePoster}
          />
          <span
            className="pointer-events-none absolute inset-0 bg-slate-950/25 transition duration-300 group-hover:bg-slate-950/40"
            aria-hidden
          />
          <span className="relative z-10 inline-flex h-16 w-16 items-center justify-center sm:h-18 sm:w-18">
            <span
              className="absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--landing-cta)_28%,transparent)] blur-md transition duration-300 group-hover:bg-[color-mix(in_srgb,var(--landing-cta)_40%,transparent)]"
              aria-hidden
            />
            <span className="relative inline-flex h-full w-full items-center justify-center rounded-full bg-(--landing-cta) shadow-[0_16px_44px_-20px_color-mix(in_srgb,var(--landing-cta)_70%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--landing-cta)_35%,white_65%)] transition duration-300 group-hover:scale-105 group-hover:bg-(--landing-cta-bright)">
              <Play
                className="h-7 w-7 translate-x-px text-(--landing-cta-text) sm:h-8 sm:w-8"
                fill="currentColor"
              />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
