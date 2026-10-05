import { createHostedDemo } from "./hosted-demo.js";
import { localPortfolioStore } from "./local-portfolio-store.js";
import { atlantaDate } from "./domain.js";
import { openAIProvider } from "./corey.js";
import { createApp } from "./app.js";
try {
  process.loadEnvFile(".env");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (process.env.NODE_ENV === "production")
  throw new Error(
    "Local demo only: replace demo identity and staff access before production deployment.",
  );
const portfolioStore = process.env.TEST_PREVIEW
  ? null
  : localPortfolioStore(
      process.env.PORTFOLIO_DB_PATH || "data/portfolio.sqlite",
    );
const { app, db } = portfolioStore
  ? {
      app: createHostedDemo({
        store: portfolioStore,
        origin: process.env.APP_ORIGIN || "http://127.0.0.1:5173",
        secret: "local-development-workspace-secret-only",
        secure: false,
      }),
      db: portfolioStore,
    }
  : createApp({
      dbPath: process.env.DB_PATH || "data/corerunner.sqlite",
      demo: true,
      ...(process.env.TEST_PREVIEW
        ? { scheduleNow: () => new Date(atlantaDate() + "T16:00:00Z") }
        : {}),
      coreyMode: process.env.COREY_MODE === "live" ? "live" : "mock",
      aiProvider: process.env.COREY_MODE === "live" ? openAIProvider() : null,
    });
const server = app.listen(
  Number(process.env.API_PORT || 3001),
  "127.0.0.1",
  () =>
    console.log(
      `CoreRunner local demo API: http://127.0.0.1:${process.env.API_PORT || 3001}`,
    ),
);
function close() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
