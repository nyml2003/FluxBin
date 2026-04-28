import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@fluxbin/client": resolve(process.cwd(), "packages/client/src/index.ts"),
      "@fluxbin/core": resolve(process.cwd(), "packages/core/src/index.ts"),
      "@fluxbin/transport-websocket": resolve(process.cwd(), "packages/transport-websocket/src/index.ts"),
      "@fluxbin/devtools": resolve(process.cwd(), "packages/devtools/src/index.ts")
    }
  },
  test: {
    environment: "node",
    include: ["packages/*/test/**/*.test.ts"],
    coverage: {
      exclude: [
        "**/bench/**",
        "**/coverage/**",
        "**/dist/**",
        "**/examples/**",
        "**/scripts/**",
        "**/eslint.config.mjs",
        "**/tsup.config.ts",
        "**/vitest.config.ts",
        "**/src/index.ts",
        "**/packages/*/src/types.ts",
        "**/src/**/*.d.ts",
        "**/src/**/error-types.ts",
        "**/src/**/frame-types.ts",
        "**/src/**/registry-types.ts",
        "**/src/**/compiled-shape.ts"
      ],
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
  }
});
