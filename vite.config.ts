/// <reference types="vitest" />
import { defineConfig } from "vite";
import { transform } from "esbuild";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: "./src/index.ts",
      },
      formats: ["es"],
      fileName: (format, entryName) =>
        format === "es" ? `${entryName}.js` : `${entryName}.${format}.js`,
    },
  },
  plugins: [
    {
      name: "minifyEs",
      renderChunk: {
        order: "post",
        async handler(code, _, outputOptions) {
          if (outputOptions.format === "es") {
            return await transform(code, { minify: true });
          }
          return code;
        },
      },
    },
  ],
  define: {
    "import.meta.vitest": false,
  },
  test: {
    api: {
      host: "0.0.0.0",
    },
    includeSource: ["src/**/*.{js,ts}"],
    coverage: {
      provider: "istanbul",
    },
  },
});
