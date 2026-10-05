import { createHostedDemo } from "../server/hosted-demo.js";
import { hostedStore } from "../server/hosted-store.js";

let app;
export default async function handler(req, res) {
  try {
    if (!app) {
      if (process.env.APP_MODE !== "portfolio" || !process.env.DATABASE_URL)
        throw new Error("Hosted portfolio setup is incomplete");
      app = createHostedDemo({
        store: hostedStore(process.env.DATABASE_URL),
        password: process.env.DEMO_ACCESS_PASSWORD,
        secret: process.env.DEMO_SESSION_SECRET,
        origin: process.env.APP_ORIGIN,
      });
    }
    return app(req, res);
  } catch {
    res.statusCode = 503;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Hosted demo setup is incomplete. Contact the portfolio owner.",
      }),
    );
  }
}
