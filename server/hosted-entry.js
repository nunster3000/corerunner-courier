import { createHostedDemo } from "./hosted-demo.js";
import { hostedStore } from "./hosted-store.js";

export function configurationIssues(env) {
  const issues = [];
  if (env.APP_MODE !== "portfolio") issues.push("APP_MODE");
  if (!env.DATABASE_URL) issues.push("DATABASE_URL");
  if (!env.DEMO_SESSION_SECRET || env.DEMO_SESSION_SECRET.length < 32)
    issues.push("DEMO_SESSION_SECRET");
  try {
    const origin = new URL(env.APP_ORIGIN);
    if (origin.protocol !== "https:" || origin.origin !== env.APP_ORIGIN)
      issues.push("APP_ORIGIN");
  } catch {
    issues.push("APP_ORIGIN");
  }
  return issues;
}

export function createHostedHandler({
  env = process.env,
  makeStore = hostedStore,
  makeApp = createHostedDemo,
  log = console.error,
} = {}) {
  let startup;
  return async (req, res) => {
    const issues = configurationIssues(env);
    if (issues.length) {
      // Names only: never print values or raw provider errors to logs/responses.
      log(`CoreRunner setup: missing or invalid ${issues.join(", ")}`);
      return unavailable(
        res,
        "DEPLOYMENT_SETUP_REQUIRED",
        "Hosted demo configuration is incomplete. The portfolio owner needs to finish the Vercel settings.",
      );
    }
    try {
      if (!startup) {
        startup = (async () => {
          const store = makeStore(env.DATABASE_URL);
          const app = makeApp({
            store,
            secret: env.DEMO_SESSION_SECRET,
            origin: env.APP_ORIGIN,
          });
          await store.initialize();
          return app;
        })();
        // Retry a failed initialization on a later request; never cache a rejected promise.
        startup.catch(() => {
          startup = undefined;
        });
      }
      const app = await startup;
      return app(req, res);
    } catch {
      log(
        "CoreRunner setup: hosted storage initialization failed. Check the connected database and schema permissions.",
      );
      return unavailable(
        res,
        "DEPLOYMENT_STORAGE_UNAVAILABLE",
        "Hosted demo storage could not be initialized. Please retry or contact the portfolio owner.",
      );
    }
  };
}
function unavailable(res, code, error) {
  res.statusCode = 503;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ code, error }));
}
