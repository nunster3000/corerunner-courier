import {
  installAccounts,
  accountCookie,
  accountTokenHash,
} from "./accounts.js";
import express from "express";
import { createHash, randomBytes } from "node:crypto";
import { createApp } from "./app.js";
import { captureDemo, restoreDemo } from "./demo-snapshot.js";

const ttl = 2 * 60 * 60 * 1000;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const cookies = (req) =>
  Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .filter(Boolean)
      .map((p) => {
        const i = p.indexOf("=");
        return [p.slice(0, i).trim(), p.slice(i + 1)];
      }),
  );

export function createHostedDemo({
  store,
  origin,
  secret,
  secure = true,
  now = Date.now,
  snapshotLimit = 2 * 1024 * 1024,
}) {
  if (!store || typeof secret !== "string" || secret.length < 32)
    throw new Error(
      "Hosted demo requires a store and a 32-character server secret.",
    );
  const site = new URL(origin);
  if (site.origin !== origin || (secure && site.protocol !== "https:"))
    throw new Error(
      "APP_ORIGIN must be the exact HTTPS site origin, without a path or trailing slash.",
    );
  const app = express();
  app.disable("x-powered-by");
  const cookieOptions = {
    path: "/api",
    httpOnly: true,
    sameSite: "strict",
    secure,
    maxAge: ttl,
  };
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "no-referrer");
    if (req.headers.origin && req.headers.origin !== origin)
      return res
        .status(403)
        .json({ error: "Cross-origin requests are not allowed." });
    if (req.headers["sec-fetch-site"] === "cross-site")
      return res.status(403).json({ error: "Open the demo directly." });
    if (
      ["POST", "PATCH", "DELETE"].includes(req.method) &&
      !req.is("application/json")
    )
      return res.status(415).json({ error: "Use application/json." });
    next();
  });
  app.get("/api/health", (req, res) =>
    res.json({ ok: true, mode: "public-portfolio-demo" }),
  );
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api/"))
      return res.status(404).json({ error: "Endpoint not found." });
    next();
  });
  // Below Vercel's request ceiling, including base64 overhead. No disk storage.
  app.use(express.json({ limit: "3mb" }));
  app.use((req, res, next) => {
    if (
      ["POST", "PATCH", "DELETE"].includes(req.method) &&
      (!req.body || Array.isArray(req.body) || typeof req.body !== "object")
    )
      return res.status(400).json({ error: "Provide a JSON object." });
    next();
  });
  installAccounts(app, store, { secure, now, secret });
  app.use(async (req, res) => {
    const account = store.readAccountSession
      ? await store.readAccountSession(accountTokenHash(accountCookie(req)))
      : null;
    if (accountCookie(req) && !account && req.path !== "/api/operator")
      return res
        .status(401)
        .json({ error: "Your login expired. Please log in again." });
    if (
      account &&
      (req.path.startsWith("/api/auth/") || req.path.startsWith("/api/demo/"))
    )
      return res.status(403).json({
        error:
          "Sign out to use temporary demo identities. Your saved account remains separate.",
      });
    if (
      account &&
      !account.email_verified &&
      !["/api/me", "/api/operator"].includes(req.path)
    )
      return res
        .status(403)
        .json({
          code: "EMAIL_VERIFICATION_REQUIRED",
          error:
            "Open your demo inbox and verify your email before continuing.",
        });
    let token = cookies(req).cr_demo_workspace;
    let id = /^[a-f0-9]{64}$/.test(token || "") ? hash(token) : null;
    let row = account || (id ? await store.read(id) : null);
    if (account) id = account.id;
    const fresh = !row;
    if (fresh && (req.method !== "GET" || req.path !== "/api/operator"))
      return res.status(410).json({
        error:
          "This demo workspace expired. Reload the page to start a new demo.",
      });
    const chat = { sessions: new Map(), requestTimes: [] };
    const { app: demo, db } = createApp({
      dbPath: ":memory:",
      coreyMode: "mock",
      aiProvider: null,
      allowedOrigins: [origin],
      secureCookies: secure,
      chatState: chat,
      hostedDemo: true,
      persistentAccounts: !!store.findAccount,
    });
    const end = res.end.bind(res);
    let intercepted = false;
    try {
      if (fresh) {
        const ip =
          req.headers["x-vercel-forwarded-for"] ||
          req.socket.remoteAddress ||
          "unknown";
        if (!(await store.allow(`new:${hash(secret + ip)}`, 10, ttl, now())))
          return res
            .status(429)
            .json({ error: "Too many new demo workspaces. Try again later." });
        token = randomBytes(32).toString("hex");
        id = hash(token);
        // Do not inherit identity cookies from an expired workspace.
        req.headers.cookie = "";
        row = { snapshot: captureDemo(db, chat), revision: 0 };
        await store.create(id, row.snapshot, now() + ttl);
        res.cookie("cr_demo_workspace", token, cookieOptions);
      } else restoreDemo(db, chat, row.snapshot);
      if (!(await store.allow(`workspace:${id}`, 120, 60000, now())))
        return res.status(429).json({
          error: "Demo request limit reached. Try again in a minute.",
        });
      if (account) {
        const session = accountTokenHash(accountCookie(req));
        db.prepare("DELETE FROM sessions").run();
        db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
          session,
          account.id,
          now() + 60000,
        );
        req.headers.cookie = `cr_session=${accountCookie(req)}; cr_corey=${cookies(req).cr_corey || ""}`;
      }
      const beforeSnapshot = captureDemo(db, chat);
      if (account) {
        beforeSnapshot.tables.sessions = [];
        db.prepare("UPDATE users SET profile=? WHERE id=?").run(
          JSON.stringify({
            ...account.profile,
            role: account.role,
            persistent: true,
            emailVerified: !!account.email_verified,
          }),
          account.id,
        );
      }
      const before = JSON.stringify(beforeSnapshot);
      // Hold the response (including cookies and proof bytes) until persistence succeeds.
      // Every current API endpoint is non-streaming; new streaming routes must use a different adapter.
      const buffered = await new Promise((resolve, reject) => {
        res.end = (chunk, encoding, callback) => {
          if (intercepted) return res;
          intercepted = true;
          resolve({ chunk, encoding, callback });
          return res;
        };
        demo(req, res, reject);
      });
      const snapshot = captureDemo(db, chat);
      if (account) snapshot.tables.sessions = [];
      const after = JSON.stringify(snapshot);
      res.end = end;
      if (
        Buffer.byteLength(after) > (account ? 8 * 1024 * 1024 : snapshotLimit)
      ) {
        res.removeHeader("Set-Cookie");
        res.removeHeader("Content-Length");
        res.removeHeader("ETag");
        return res.status(413).json({
          error:
            "This demo workspace is full. Reset guided scenarios or start again after it expires. Use smaller sample photos.",
        });
      }
      if (
        after !== before &&
        !(await (account
          ? store.saveAccount(id, row.revision, snapshot)
          : store.save(id, row.revision, snapshot)))
      ) {
        res.removeHeader("Set-Cookie");
        res.removeHeader("Content-Length");
        res.removeHeader("ETag");
        return res.status(409).json({
          error:
            "Another demo action changed this workspace. Refresh and retry; this action was not saved.",
        });
      }
      return end(buffered.chunk, buffered.encoding, buffered.callback);
    } catch {
      res.end = end;
      res.removeHeader("Set-Cookie");
      res.removeHeader("Content-Length");
      res.removeHeader("ETag");
      return res.status(503).json({
        error:
          "Demo storage is unavailable. Please retry. No success was confirmed.",
      });
    } finally {
      res.end = end;
      db.close();
    }
  });
  app.use((error, req, res, next) => {
    if (error.type === "entity.too.large")
      return res.status(413).json({
        error:
          "Hosted demo uploads must fit within 3 MB including encoding. Choose a sample photo under 2 MB.",
      });
    if (error instanceof SyntaxError && error.status === 400)
      return res.status(400).json({ error: "Invalid JSON." });
    res
      .status(503)
      .json({ error: "The hosted demo is temporarily unavailable." });
  });
  return app;
}
