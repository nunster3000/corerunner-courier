import { randomBytes, randomUUID, createHash, createHmac } from "node:crypto";
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
export const accountUser = (account) => ({
  ...account.profile,
  id: account.id,
  role: account.role,
  persistent: true,
  emailVerified: !!account.email_verified,
});
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
    res.json({ user: accountUser(account) });
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
  const signedAccount = async (req) => {
    const account = await store.readAccountSession(
      accountTokenHash(accountCookie(req)),
    );
    if (!account) throw new Problem(401, "Log in to open your demo inbox.");
    return account;
  };
  const verificationToken = (account, session, expires, nonce) =>
    createHmac("sha256", secret)
      .update(`${account.id}:${session}:${expires}:${nonce}`)
      .digest("hex");
  app.post(
    "/api/auth/request",
    route(async (req, res) => {
      const account = await signedAccount(req);
      if (account.email_verified) return res.json({ verified: true });
      if (!(await store.allow(`verify:${account.id}`, 10, 15 * 60000, now())))
        throw new Problem(
          429,
          "Please wait before requesting another demo email.",
        );
      const session = accountTokenHash(accountCookie(req)),
        expires = now() + 10 * 60000,
        nonce = randomBytes(16).toString("hex");
      await store.setVerification(account.id, {
        session,
        expires,
        nonce,
        token: accountTokenHash(
          verificationToken(account, session, expires, nonce),
        ),
      });
      res.json({ email: account.email, simulated: true });
    }),
  );
  app.get(
    "/api/auth/inbox",
    route(async (req, res) => {
      const account = await signedAccount(req),
        v = account.verification,
        session = accountTokenHash(accountCookie(req));
      if (!v || v.session !== session || v.expires <= now())
        throw new Problem(404, "Request a new demo verification email.");
      res.json({
        email: account.email,
        token: verificationToken(account, session, v.expires, v.nonce),
        expires: v.expires,
        simulated: true,
      });
    }),
  );
  app.post(
    "/api/auth/verify",
    route(async (req, res) => {
      const account = await signedAccount(req),
        session = accountTokenHash(accountCookie(req));
      if (
        typeof req.body.token !== "string" ||
        !(await store.verifyAccount(
          account.id,
          session,
          accountTokenHash(req.body.token),
          now(),
        ))
      )
        throw new Problem(
          400,
          "Verification expired or invalid. Request another demo email.",
        );
      res.json({
        user: accountUser({ ...account, email_verified: true }),
        simulated: true,
      });
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
