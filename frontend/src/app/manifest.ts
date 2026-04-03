import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard",
    name: "PlanSync",
    short_name: "PlanSync",
    description:
      "Construction workspace: projects, drawings, RFIs, takeoff, and PDF viewer — cloud or local.",
    /** Home screen / installed app opens the signed-in workspace dashboard (not the public viewer). */
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "browser"],
    orientation: "any",
    background_color: "#111827",
    theme_color: "#3b82f6",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/logo.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
    ],
  };
}
