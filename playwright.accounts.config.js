import base from "./playwright.config.js";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  ...base,
  testDir: "./tests-accounts",
  use: { ...base.use, baseURL: "http://127.0.0.1:5176" },
  webServer: {
    command: "npm run dev -- --port 5176 --strictPort",
    env: {
      COREY_MODE: "mock",
      OPENAI_API_KEY: "",
      API_PORT: "3006",
      PORTFOLIO_DB_PATH: ":memory:",
      APP_ORIGIN: "http://127.0.0.1:5176",
      TEST_PREVIEW: "",
    },
    url: "http://127.0.0.1:5176",
    reuseExistingServer: false,
  },
});
