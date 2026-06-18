import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    // The source is NodeNext ESM and uses ".js" import specifiers that point at
    // ".ts" files on disk. Map ".js" back to ".ts" first so Vitest can resolve
    // them without a build step.
    extensionAlias: { ".js": [".ts", ".js"] },
  },
});
