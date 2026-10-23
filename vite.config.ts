import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    target: "es2020",
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "index.js",
    },
  },
  define: {
    "import.meta.vitest": "undefined",
  },
  test: {
    include: ["tests/**/*.test.ts"],
    includeSource: ["src/**/*.ts"],
    coverage: {
      provider: "istanbul",
      include: ["src/**/*.ts"],
      exclude: ["src/vite-env.d.ts"],
    },
  },
});
