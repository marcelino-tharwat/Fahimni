import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.e2e.test.ts"],
    setupFiles: ["./src/test/e2e-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Real HTTP + shared test DB — run serially to keep fixtures deterministic.
    fileParallelism: false,
  },
  resolve: {
    extensionAlias: { ".js": [".ts", ".js"] },
  },
});
