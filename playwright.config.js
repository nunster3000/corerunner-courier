import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const localChrome =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:5175",
    launchOptions: existsSync(localChrome)
      ? { executablePath: localChrome }
      : {},
  },
  webServer: {
    command: "npm run dev -- --port 5175 --strictPort",
    env: { API_PORT: "3005", DB_PATH: ":memory:", TEST_PREVIEW: "1" },
    url: "http://127.0.0.1:5175",
    reuseExistingServer: false,
  },
});
