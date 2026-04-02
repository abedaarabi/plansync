import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svgPath = join(root, "public/logo.svg");
const outDir = join(root, "public/icons");
const sizes = [180, 192, 512];

async function allPngsPresent() {
  try {
    for (const size of sizes) {
      const st = await stat(join(outDir, `icon-${size}.png`));
      if (!st.isFile() || st.size < 100) return false;
    }
    return true;
  } catch {
    return false;
  }
}

await mkdir(outDir, { recursive: true });

if (process.env.FORCE_PWA_ICONS !== "1" && (await allPngsPresent())) {
  console.log(
    "PWA icons already present (public/icons/icon-*.png); skip sharp. Set FORCE_PWA_ICONS=1 to regenerate.",
  );
  process.exit(0);
}

const sharp = (await import("sharp")).default;
const svg = await readFile(svgPath);

for (const size of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(outDir, `icon-${size}.png`));
}

console.log("Wrote PNG icons to public/icons/");
