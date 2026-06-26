import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // E2E tests run via vitest.e2e.config.ts against the isolated test DB, so
    // they are excluded from the default unit/integration run.
    exclude: [...configDefaults.exclude, "src/**/*.e2e.test.ts"],
  },
  resolve: {
    // The source is NodeNext ESM and uses ".js" import specifiers that point at
    // ".ts" files on disk. Map ".js" back to ".ts" first so Vitest can resolve
    // them without a build step.
    extensionAlias: { ".js": [".ts", ".js"] },
  },
});
