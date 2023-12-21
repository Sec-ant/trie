/// <reference types="vitest" />
import { transform } from "esbuild";
import PreprocessorDirectives from "unplugin-preprocessor-directives/vite";
import { defineConfig } from "vite";

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
    { ...PreprocessorDirectives(), apply: "build" },
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
