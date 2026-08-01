import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "../node_modules/pdfjs-dist/build/pdf.worker.mjs");
const dest = join(root, "public/pdf.worker.mjs");

await mkdir(dirname(dest), { recursive: true });
await copyFile(src, dest);
console.log("copy-pdf-worker: synced public/pdf.worker.mjs from pdfjs-dist");
