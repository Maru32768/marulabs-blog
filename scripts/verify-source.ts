/**
 * Scans the repository for content that must not be public. Anything committed here is
 * public, so this also runs over the full Git history in CI (--history).
 *
 * Usage: node scripts/verify-source.ts [--history]
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { checkSourceFile, checkTrackedPath, findSecrets, isBinaryPath, reviewHints } from "./lib/boundary.ts";

const { values } = parseArgs({ options: { history: { type: "boolean", default: false } } });

const git = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

const problems: string[] = [];
const warnings: string[] = [];

// Tracked files plus anything new that is not ignored, so a file is caught before it is committed.
const files = git("ls-files", "--cached", "--others", "--exclude-standard").split("\n").filter(Boolean);

for (const path of files) {
  problems.push(...checkTrackedPath(path));
  if (isBinaryPath(path)) continue;
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    continue; // Deleted in the working tree but still in the index.
  }
  problems.push(...checkSourceFile(path, text));
  if (path.startsWith("src/content/articles/")) {
    for (const hint of reviewHints(text)) warnings.push(`${path}: ${hint}`);
  }
}

if (values.history) {
  const commits = git("rev-list", "--all").split("\n").filter(Boolean).length;
  for (const path of new Set(git("log", "--all", "--name-only", "--format=").split("\n").filter(Boolean))) {
    problems.push(...checkTrackedPath(path).map((p) => `history: ${p}`));
  }
  for (const name of findSecrets(git("log", "--all", "-p", "--no-color", "--format="))) {
    problems.push(`history: looks like a secret (${name})`);
  }
  console.log(`Scanned ${commits} commit(s) of history.`);
}

for (const warning of warnings) console.warn(`Review: ${warning}`);

if (problems.length > 0) {
  console.error("Source check failed:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`Source check passed: ${files.length} file(s).`);
