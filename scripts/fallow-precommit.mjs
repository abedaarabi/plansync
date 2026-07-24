#!/usr/bin/env node
/**
 * Pre-commit Fallow gate:
 * 1. Full-repo dead-code scan (must stay clean).
 * 2. Audit staged diff for newly introduced duplication, complexity, and dead code.
 *
 * Staged diffs are written to a temp file (not buffered via execSync) so large
 * commits (WASM, workers, lockfiles) do not hit Node ENOBUFS / maxBuffer limits.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: "inherit" });
}

run("npx", ["fallow", "dead-code", "--quiet", "--fail-on-issues"]);

const diffDir = mkdtempSync(join(tmpdir(), "fallow-precommit-"));
const diffPath = join(diffDir, "staged.diff");
const fd = openSync(diffPath, "w");
try {
  const diff = spawnSync("git", ["diff", "--cached"], {
    stdio: ["ignore", fd, "inherit"],
  });
  if (diff.status !== 0 && diff.status != null) {
    process.exit(diff.status);
  }
  if (diff.error) throw diff.error;
} finally {
  closeSync(fd);
}

try {
  if (statSync(diffPath).size === 0) {
    console.log("fallow: no staged changes, skipping audit");
    process.exit(0);
  }

  run("npx", ["fallow", "audit", "--diff-file", diffPath, "--quiet", "--fail-on-issues"]);
} finally {
  rmSync(diffDir, { recursive: true, force: true });
}
