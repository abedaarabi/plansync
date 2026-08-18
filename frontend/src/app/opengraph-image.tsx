import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_SHARE_IMAGE } from "@/lib/siteUrl";

export const alt = "PlanSync 3D BIM viewer — digital delivery platform for data centers.";

export const size = { width: SITE_SHARE_IMAGE.width, height: SITE_SHARE_IMAGE.height };

export const contentType = SITE_SHARE_IMAGE.type;

/** Serve the public 3D screenshot so Twitter/X and Open Graph crawlers get a static JPEG. */
export default async function Image() {
  const bytes = await readFile(join(process.cwd(), SITE_SHARE_IMAGE.file));
  return new Response(Uint8Array.from(bytes), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
