import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      },
      exclude: [
        "**/dist/**",
        "**/tsup.config.ts",
        "**/vitest.config.ts",
        "**/src/index.ts",
        "**/src/**/*.d.ts",
        "**/src/**/error-types.ts",
        "**/src/**/frame-types.ts",
        "**/src/**/registry-types.ts",
        "**/src/**/compiled-shape.ts"
      ]
    }
  }
});
