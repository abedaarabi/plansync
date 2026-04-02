import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svgPath = join(root, "public/logo.svg");
const outDir = join(root, "public/icons");

await mkdir(outDir, { recursive: true });
const svg = await readFile(svgPath);

for (const size of [180, 192, 512]) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(outDir, `icon-${size}.png`));
}

console.log("Wrote PNG icons to public/icons/");
