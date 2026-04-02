import path from "node:path";

/**
 * ESLint + Next.js rules expect `cwd` to be the app package. Running from the
 * monorepo root breaks `no-html-link-for-pages` and lints `public/pdf.worker.mjs`.
 */
function eslintInPackage(pkg, files) {
  const root = process.cwd();
  const pkgDir = path.join(root, pkg);
  const rel = files.map((f) => {
    const abs = path.isAbsolute(f) ? f : path.join(root, f);
    return JSON.stringify(path.relative(pkgDir, abs));
  });
  return `cd ${pkg} && eslint --fix ${rel.join(" ")}`;
}

export default {
  "frontend/**/*.{js,jsx,mjs,cjs,ts,tsx}": (files) => {
    if (!files.length) return [];
    return [
      eslintInPackage("frontend", files),
      `prettier --write ${files.map((f) => JSON.stringify(f)).join(" ")}`,
    ];
  },
  "backend/**/*.ts": (files) => {
    if (!files.length) return [];
    return [
      eslintInPackage("backend", files),
      `prettier --write ${files.map((f) => JSON.stringify(f)).join(" ")}`,
    ];
  },
  "*.{json,md,css,yml,yaml}": (files) =>
    files.length ? `prettier --write ${files.map((f) => JSON.stringify(f)).join(" ")}` : [],
};
