"use client";

import dynamic from "next/dynamic";
import type { ProjectLocationMapInnerProps } from "./ProjectLocationMapInner";

const Inner = dynamic(
  () => import("./ProjectLocationMapInner").then((m) => m.ProjectLocationMapInner),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-[220px] w-full animate-pulse rounded-xl bg-[var(--enterprise-bg)]"
        aria-hidden
      />
    ),
  },
);

export function ProjectLocationMap(props: ProjectLocationMapInnerProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--enterprise-border)] [&_.leaflet-container]:z-0">
      <Inner {...props} />
    </div>
  );
}

export type { ProjectLocationMapInnerProps as ProjectLocationMapProps };
