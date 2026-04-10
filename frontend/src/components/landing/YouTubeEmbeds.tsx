"use client";

import Image from "next/image";
import { useState } from "react";
import { Play } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { YOUTUBE_HERO_DEMO_ID, YOUTUBE_WALKTHROUGH_ID } from "./constants";

function YouTubePosterEmbed({
  videoId,
  title,
  playAriaLabel,
  posterAlt,
  /** Above-the-fold hero: no lazy + hints LCP (walkthrough stays lazy). */
  posterPriority = false,
}: {
  videoId: string;
  title: string;
  playAriaLabel: string;
  posterAlt: string;
  posterPriority?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const posterUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  if (playing) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group absolute inset-0 flex items-center justify-center"
      aria-label={playAriaLabel}
    >
      <Image
        src={posterUrl}
        alt={posterAlt}
        fill
        className="object-cover"
        priority={posterPriority}
        loading={posterPriority ? undefined : "lazy"}
        fetchPriority={posterPriority ? "high" : undefined}
        sizes="(max-width: 1024px) 100vw, 50vw"
        unoptimized
      />
      <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--landing-cta)] shadow-xl shadow-blue-600/30 transition group-hover:scale-110 group-hover:bg-[var(--landing-cta-bright)] sm:h-20 sm:w-20">
        <Play className="h-6 w-6 translate-x-0.5 text-white sm:h-8 sm:w-8" fill="white" />
      </div>
      <div className="absolute inset-0 bg-black/20 transition group-hover:bg-black/30" />
    </button>
  );
}

export function HeroYouTubeEmbed() {
  return (
    <YouTubePosterEmbed
      videoId={YOUTUBE_WALKTHROUGH_ID}
      title="PlanSync walkthrough"
      playAriaLabel="Play walkthrough video"
      posterAlt="PlanSync walkthrough video thumbnail"
    />
  );
}

/** YouTube demo — poster loads with the hero (no observer flash); iframe only after play. */
export function LandingHeroDemoVideo() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="relative aspect-video overflow-hidden bg-slate-900">
      {reducedMotion ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-800 px-4 text-center text-[12px] leading-relaxed text-slate-400">
          <span>Plan viewer demo (animation reduced for your motion settings)</span>
          <a
            href={`https://youtu.be/${YOUTUBE_HERO_DEMO_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sky-400 underline decoration-sky-400/50 underline-offset-2 transition hover:text-sky-300"
          >
            Watch on YouTube
          </a>
        </div>
      ) : (
        <YouTubePosterEmbed
          videoId={YOUTUBE_HERO_DEMO_ID}
          title="PlanSync viewer demo — open PDF, calibrate, measure, markup"
          playAriaLabel="Play PlanSync viewer demo video"
          posterAlt="PlanSync viewer demo video thumbnail"
          posterPriority
        />
      )}
    </div>
  );
}
