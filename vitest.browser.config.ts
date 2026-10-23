import { playwright } from "@vitest/browser-playwright";
import { defineConfig, mergeConfig } from "vitest/config";
import config from "./vite.config.ts";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        instances: [{ browser: "chromium" }, { browser: "firefox" }],
        screenshotFailures: false,
      },
    },
  }),
);
