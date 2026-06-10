#!/usr/bin/env node
/**
 * Pre-commit Fallow gate:
 * 1. Full-repo dead-code scan (must stay clean).
 * 2. Audit staged diff for newly introduced duplication, complexity, and dead code.
 */
import { execFileSync, execSync } from "node:child_process";

function run(cmd, args, { input } = {}) {
  execFileSync(cmd, args, {
    stdio: input !== undefined ? ["pipe", "inherit", "inherit"] : "inherit",
    input,
  });
}

run("npx", ["fallow", "dead-code", "--quiet", "--fail-on-issues"]);

const stagedDiff = execSync("git diff --cached", { encoding: "utf8" });
if (!stagedDiff.trim()) {
  console.log("fallow: no staged changes, skipping audit");
  process.exit(0);
}

run("npx", ["fallow", "audit", "--diff-stdin", "--quiet", "--fail-on-issues"], {
  input: stagedDiff,
});
