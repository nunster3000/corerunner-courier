import { randomBytes, randomUUID, createHash } from "node:crypto";
import { profile, email, Problem } from "./domain.js";
import { passwordHash, passwordMatches } from "./passwords.js";
import { createApp } from "./app.js";
import { captureDemo } from "./demo-snapshot.js";
export const accountTokenHash = (value) =>
  createHash("sha256")
    .update(value || "")
    .digest("hex");
export const accountCookie = (req) =>
  (req.headers.cookie || "")
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith("cr_account="))
    ?.slice(11);
export function installAccounts(app, store, { secure, now, secret }) {
  if (!store.findAccount) return;
  const cookie = {
    path: "/api",
    httpOnly: true,
    sameSite: "strict",
    secure,
    maxAge: 7 * 86400000,
  };
  const route = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      res.status(e instanceof Problem ? e.status : 503).json({
        error:
          e instanceof Problem
            ? e.message
            : "Account storage is unavailable. Please retry; no success was confirmed.",
      });
    }
  };
  async function limit(req, res) {
    const ip =
      req.headers["x-vercel-forwarded-for"] ||
      req.socket.remoteAddress ||
      "unknown";
    const key = accountTokenHash(secret + ip);
    if (!(await store.allow(`account:${key}`, 15, 15 * 60000, now()))) {
      res.status(429).json({
        error: "Too many sign-in attempts. Please try again in 15 minutes.",
      });
      return false;
    }
    return true;
  }
  async function signIn(res, account) {
    const token = randomBytes(32).toString("hex");
    await store.createAccountSession(
      accountTokenHash(token),
      account.id,
      now() + cookie.maxAge,
    );
    res.cookie("cr_account", token, cookie);
    for (const name of [
      "cr_session",
      "cr_staff",
      "cr_courier",
      "cr_challenge",
      "cr_corey",
    ])
      res.clearCookie(name, { path: "/api" });
    res.json({
      user: {
        ...account.profile,
        id: account.id,
        role: account.role,
        persistent: true,
      },
    });
  }
  app.post(
    "/api/auth/register",
    route(async (req, res) => {
      if (!(await limit(req, res))) return;
      const p = profile(req.body);
      if (p.phone.replace(/\D/g, "").length < 10)
        throw new Problem(400, "Enter a valid phone number.");
      const password = await passwordHash(req.body.password);
      const account = {
        id: randomUUID(),
        email: p.email,
        profile: p,
        role: "customer",
        password,
      };
      const { db } = createApp({ dbPath: ":memory:" });
      try {
        db.prepare("INSERT INTO users VALUES(?,?,?)").run(
          account.id,
          p.email,
          JSON.stringify(p),
        );
        account.snapshot = captureDemo(db, {
          sessions: new Map(),
          requestTimes: [],
        });
      } finally {
        db.close();
      }
      if (!(await store.createAccount(account)))
        throw new Problem(
          409,
          "An account already uses this email. Please log in instead.",
        );
      await signIn(res, account);
    }),
  );
  app.post(
    "/api/auth/login",
    route(async (req, res) => {
      if (!(await limit(req, res))) return;
      const address = email(req.body.email);
      const account = await store.findAccount(address);
      const valid = await passwordMatches(req.body.password, account?.password);
      if (!account || !valid)
        throw new Problem(401, "Email or password is incorrect.");
      await signIn(res, account);
    }),
  );
  app.post(
    ["/api/auth/signout", "/api/logout"],
    route(async (req, res) => {
      await store.deleteAccountSession(accountTokenHash(accountCookie(req)));
      res.clearCookie("cr_account", { path: "/api" });
      for (const name of [
        "cr_session",
        "cr_staff",
        "cr_courier",
        "cr_challenge",
        "cr_corey",
        "cr_demo_workspace",
      ])
        res.clearCookie(name, { path: "/api" });
      res.json({ ok: true });
    }),
  );
}
