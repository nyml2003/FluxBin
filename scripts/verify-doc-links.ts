import { access } from "node:fs/promises";
import { resolve } from "node:path";

const requiredPaths = [
  "docs/spec/01-core-model.md",
  "docs/spec/04-shape-registry.md",
  "docs/engineering/code-style-spec.md",
  "docs/test-spec.md"
];

await Promise.all(
  requiredPaths.map(async (relativePath) => {
    await access(resolve(process.cwd(), relativePath));
  })
);

console.log(`Verified ${String(requiredPaths.length)} required documentation paths.`);
