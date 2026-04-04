import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svgPath = join(root, "public/logo.svg");
const splashManifestPath = join(root, "src/lib/pwaAppleSplashScreens.json");
const iconDir = join(root, "public/icons");
const splashDir = join(root, "public/splash");
const iconSizes = [180, 192, 512];

/** Matches enterprise shell / PWA splash (see manifest.background_color). */
const SPLASH_BG = "#0f172a";

async function allIconsPresent() {
  try {
    for (const size of iconSizes) {
      const st = await stat(join(iconDir, `icon-${size}.png`));
      if (!st.isFile() || st.size < 100) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function allSplashesPresent(screens) {
  try {
    for (const { w, h } of screens) {
      const st = await stat(join(splashDir, `apple-splash-${w}x${h}.png`));
      if (!st.isFile() || st.size < 500) return false;
    }
    return true;
  } catch {
    return false;
  }
}

await mkdir(iconDir, { recursive: true });
await mkdir(splashDir, { recursive: true });

const splashScreens = JSON.parse(await readFile(splashManifestPath, "utf8"));

const regenIcons = process.env.FORCE_PWA_ICONS === "1" || !(await allIconsPresent());
const regenSplash =
  process.env.FORCE_PWA_SPLASH === "1" || !(await allSplashesPresent(splashScreens));

if (!regenIcons && !regenSplash) {
  console.log(
    "PWA assets up to date (public/icons + public/splash). Set FORCE_PWA_ICONS=1 or FORCE_PWA_SPLASH=1 to regenerate.",
  );
  process.exit(0);
}

const sharp = (await import("sharp")).default;
const svg = await readFile(svgPath);

if (regenIcons) {
  for (const size of iconSizes) {
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(join(iconDir, `icon-${size}.png`));
  }
  console.log("Wrote PNG icons to public/icons/");
}

if (regenSplash) {
  for (const { w, h } of splashScreens) {
    const logoSize = Math.min(420, Math.round(Math.min(w, h) * 0.19));
    const logoPng = await sharp(svg).resize(logoSize, logoSize).png().toBuffer();
    await sharp({
      create: {
        width: w,
        height: h,
        channels: 4,
        background: SPLASH_BG,
      },
    })
      .composite([
        {
          input: logoPng,
          top: Math.round((h - logoSize) / 2),
          left: Math.round((w - logoSize) / 2),
        },
      ])
      .png()
      .toFile(join(splashDir, `apple-splash-${w}x${h}.png`));
  }
  console.log(`Wrote ${splashScreens.length} Apple splash screens to public/splash/`);
}
