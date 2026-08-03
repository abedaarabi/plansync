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
  // Canonical schema before validate / format --check in the pre-commit hook
  "backend/prisma/schema.prisma": () => "cd backend && npx prisma format",
  "frontend/**/*.{js,jsx,mjs,cjs,ts,tsx}": (files) => {
    // Vendored bundles (e.g. pdf.js worker) must not be eslint/prettier'd —
    // formatting them can wipe the staged content and yield an empty commit.
    const sourceFiles = files.filter(
      (f) => !/[\\/]public[\\/].*\.worker\.(m?js|cjs)$/.test(f),
    );
    if (!sourceFiles.length) return [];
    return [
      eslintInPackage("frontend", sourceFiles),
      `prettier --write ${sourceFiles.map((f) => JSON.stringify(f)).join(" ")}`,
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
