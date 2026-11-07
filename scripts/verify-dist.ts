/**
 * Verifies a build against the publication boundary.
 *
 * Usage: node scripts/verify-dist.ts [--dir dist] [--content src/content/articles]
 */
import { parseArgs } from "node:util";
import { readPublishedSlugs, verifyDist } from "./lib/boundary.ts";

const { values } = parseArgs({
  options: {
    dir: { type: "string", default: "dist" },
    content: { type: "string", default: "src/content/articles" },
  },
});

const slugs = readPublishedSlugs(values.content);
const problems = verifyDist(values.dir, slugs);

if (problems.length > 0) {
  console.error(`Boundary check failed for ${values.dir}:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`Boundary check passed for ${values.dir}: exactly ${slugs.length} published article(s).`);
