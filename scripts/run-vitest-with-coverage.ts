/**
 * Root vitest coverage wrapper.
 *
 * This script exists to make root coverage runs stable on Windows. Before
 * invoking Vitest with coverage enabled, it clears and recreates the root
 * coverage temp directory so the V8 provider has a consistent place to write.
 */
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const rootCoveragePath = resolve(process.cwd(), "coverage");
const rootCoverageTmpPath = resolve(rootCoveragePath, ".tmp");

async function prepareCoverageDirectory() {
  await rm(rootCoveragePath, { force: true, recursive: true });
  await mkdir(rootCoverageTmpPath, { recursive: true });
}

function runVitest() {
  return new Promise<number>((resolveExitCode, rejectExitCode) => {
    const command = "pnpm exec vitest run --coverage";
    const child = spawn(
      command,
      [],
      {
        cwd: process.cwd(),
        shell: true,
        stdio: "inherit"
      }
    );

    child.on("error", rejectExitCode);
    child.on("exit", (code) => {
      let resolvedCode = 1;
      if (code !== null) {
        resolvedCode = code;
      }

      resolveExitCode(resolvedCode);
    });
  });
}

await prepareCoverageDirectory();
const exitCode = await runVitest();
process.exit(exitCode);
