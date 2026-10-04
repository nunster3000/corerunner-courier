import express from "express";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { openDatabase, transaction } from "./db.js";
import {
  Problem,
  fail,
  text,
  email,
  profile,
  delivery,
  price,
  stamp,
} from "./domain.js";
const secret = () => randomBytes(32).toString("hex");
const hash = (value) =>
  createHash("sha256")
    .update(value || "")
    .digest("hex");
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
const cookie = (res, name, value, maxAge) =>
  res.cookie(name, value, {
    httpOnly: true,
    sameSite: "strict",
    path: "/api",
    maxAge,
  });
export function createApp({
  dbPath = "data/corerunner.sqlite",
  demo = true,
} = {}) {
  const app = express(),
    db = openDatabase(dbPath);
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "no-referrer");
    // This development application binds loopback. Reject cross-origin browser writes and non-JSON mutations.
    const origin = req.get("origin");
    if (origin) {
      try {
        const u = new URL(origin);
        if (!["localhost", "127.0.0.1"].includes(u.hostname))
          return res
            .status(403)
            .json({ error: "Cross-origin requests are not allowed." });
      } catch {
        return res.status(403).json({ error: "Invalid origin." });
      }
    }
    if (
      ["POST", "PATCH", "DELETE"].includes(req.method) &&
      !req.is("application/json")
    )
      return res.status(415).json({ error: "Use application/json." });
    next();
  });
  app.use(express.json({ limit: "64kb" }));
  app.use((req, res, next) => {
    if (
      ["POST", "PATCH", "DELETE"].includes(req.method) &&
      (!req.body || Array.isArray(req.body) || typeof req.body !== "object")
    )
      return res.status(400).json({ error: "Provide a JSON object." });
    next();
  });
  const auth = (req, res, next) => {
    const s = db
      .prepare(
        "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
      )
      .get(hash(cookies(req).cr_session), Date.now());
    if (!s) return res.status(401).json({ error: "Sign in to continue." });
    req.user = { id: s.id, ...JSON.parse(s.profile), email: s.email };
    next();
  };
  const staff = (req, res, next) => {
    if (
      !db
        .prepare("SELECT 1 FROM staff_sessions WHERE token=? AND expires>?")
        .get(hash(cookies(req).cr_staff), Date.now())
    )
      return res
        .status(403)
        .json({ error: "Open a demo dispatch session first." });
    next();
  };
  const demoOnly = (req, res, next) =>
    demo
      ? next()
      : res.status(404).json({ error: "Demo endpoints are disabled." });
  const read = (id) => {
    const r = db.prepare("SELECT * FROM bookings WHERE id=?").get(id);
    if (!r) fail(404, "Delivery not found.");
    return { ...JSON.parse(r.payload), userId: r.user_id, quoteId: r.quote_id };
  };
  const owned = (req) => {
    const b = read(req.params.id);
    if (b.userId !== req.user.id) fail(404, "Delivery not found.");
    return b;
  };
  const save = (b) => {
    const { userId, quoteId, ...payload } = b;
    db.prepare("UPDATE bookings SET payload=? WHERE id=?").run(
      JSON.stringify(payload),
      b.id,
    );
  };
  const event = (b, actor, kind, detail = {}) =>
    db
      .prepare(
        "INSERT INTO events(booking_id,actor,kind,created,detail) VALUES(?,?,?,?,?)",
      )
      .run(b.id, actor, kind, stamp(), JSON.stringify(detail));
  const payment = (b, kind, amount) =>
    db
      .prepare(
        "INSERT INTO payments(booking_id,kind,amount,created) VALUES(?,?,?,?)",
      )
      .run(b.id, kind, amount, stamp());
  const notify = (b, subject, body) => {
    const u = db.prepare("SELECT email FROM users WHERE id=?").get(b.userId);
    for (const recipient of new Set([u.email, b.delivery.recipientEmail]))
      db.prepare(
        "INSERT INTO notifications(user_id,recipient,subject,body,created) VALUES(?,?,?,?,?)",
      ).run(b.userId, recipient, subject, body, stamp());
  };
  const present = (b) => ({
    ...b,
    events: db
      .prepare(
        "SELECT kind,created,detail FROM events WHERE booking_id=? ORDER BY id",
      )
      .all(b.id)
      .map((e) => ({ ...e, detail: JSON.parse(e.detail) })),
    payments: db
      .prepare(
        "SELECT kind,amount,created FROM payments WHERE booking_id=? ORDER BY id",
      )
      .all(b.id),
  });
  app.get("/api/health", (req, res) =>
    res.json({ ok: true, mode: demo ? "local-demo" : "disabled" }),
  );
  const attempts = new Map();
  app.post("/api/auth/request", demoOnly, (req, res) => {
    const p = profile(req.body);
    if (p.phone.replace(/\D/g, "").length < 10)
      fail(400, "Enter a valid phone number.");
    const previous = attempts.get(p.email) || [];
    const recent = previous.filter((t) => t > Date.now() - 60000);
    if (recent.length >= 10)
      fail(429, "Please wait a minute before requesting another email.");
    attempts.set(p.email, [...recent, Date.now()]);
    const old = cookies(req).cr_challenge;
    if (old) db.prepare("DELETE FROM challenges WHERE id=?").run(hash(old));
    const challenge = secret(),
      token = secret();
    db.prepare("INSERT INTO challenges VALUES(?,?,?,?)").run(
      hash(challenge),
      hash(token),
      JSON.stringify({ ...p, demoToken: token }),
      Date.now() + 600000,
    );
    cookie(res, "cr_challenge", challenge, 600000);
    res.json({
      message: "Verification created in your browser-bound demo inbox.",
      email: p.email,
    });
  });
  app.get("/api/auth/inbox", demoOnly, (req, res) => {
    const c = db
      .prepare("SELECT * FROM challenges WHERE id=? AND expires>?")
      .get(hash(cookies(req).cr_challenge), Date.now());
    if (!c) fail(404, "Request a new verification email.");
    const p = JSON.parse(c.profile);
    res.json({
      email: p.email,
      token: p.demoToken,
      expires: c.expires,
      simulated: true,
    });
  });
  app.post("/api/auth/verify", demoOnly, (req, res) => {
    const result = transaction(db, () => {
      const id = hash(cookies(req).cr_challenge),
        c = db
          .prepare("SELECT * FROM challenges WHERE id=? AND expires>?")
          .get(id, Date.now());
      if (!c || hash(String(req.body.token)) !== c.token)
        fail(400, "Verification expired or invalid. Request another email.");
      const { demoToken, ...p } = JSON.parse(c.profile);
      let u = db.prepare("SELECT id FROM users WHERE email=?").get(p.email);
      if (!u) {
        u = { id: randomUUID() };
        db.prepare("INSERT INTO users VALUES(?,?,?)").run(
          u.id,
          p.email,
          JSON.stringify(p),
        );
      } else
        db.prepare("UPDATE users SET profile=? WHERE id=?").run(
          JSON.stringify(p),
          u.id,
        );
      db.prepare("DELETE FROM challenges WHERE id=?").run(id);
      const token = secret();
      db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
        hash(token),
        u.id,
        Date.now() + 86400000,
      );
      return { token, user: { id: u.id, ...p } };
    });
    cookie(res, "cr_session", result.token, 86400000);
    res.clearCookie("cr_challenge", { path: "/api" });
    res.json({ user: result.user });
  });
  app.get("/api/me", auth, (req, res) => res.json({ user: req.user }));
  app.post("/api/logout", (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token=?").run(
      hash(cookies(req).cr_session),
    );
    res.clearCookie("cr_session", { path: "/api" });
    res.json({ ok: true });
  });
  app.post("/api/quotes", auth, (req, res) => {
    const d = delivery(req.body),
      q = {
        id: randomUUID(),
        delivery: d,
        price: price(d),
        expires: Date.now() + 15 * 60000,
      };
    db.prepare("INSERT INTO quotes VALUES(?,?,?,?)").run(
      q.id,
      req.user.id,
      JSON.stringify(q),
      q.expires,
    );
    res.status(201).json(q);
  });
  app.post("/api/bookings", auth, (req, res) => {
    const key = text(req.get("Idempotency-Key"), "Idempotency key", 100);
    const result = transaction(db, () => {
      const previous = db
        .prepare(
          "SELECT id,quote_id FROM bookings WHERE user_id=? AND request_key=?",
        )
        .get(req.user.id, key);
      if (previous) {
        if (previous.quote_id !== req.body.quoteId)
          fail(409, "This request key already belongs to another quote.");
        return { booking: present(read(previous.id)), reused: true };
      }
      const row = db
        .prepare("SELECT * FROM quotes WHERE id=? AND user_id=?")
        .get(String(req.body.quoteId), req.user.id);
      if (!row) fail(404, "Quote not found.");
      const existing = db
        .prepare("SELECT id FROM bookings WHERE quote_id=?")
        .get(row.id);
      if (existing)
        return { booking: present(read(existing.id)), reused: true };
      if (row.expires < Date.now())
        fail(409, "Your quote expired. Request a fresh quote.");
      if (req.body.accepted !== true)
        fail(400, "Confirm the quote and return policy before booking.");
      if (req.body.paymentOutcome === "decline")
        fail(
          402,
          "Simulated authorization declined. No booking was created. Retry with approval.",
        );
      const q = JSON.parse(row.payload);
      delivery(q.delivery);
      const b = {
        id: "CR-" + randomBytes(5).toString("hex").toUpperCase(),
        userId: req.user.id,
        quoteId: q.id,
        delivery: q.delivery,
        price: q.price,
        status:
          q.delivery.item === "Groceries"
            ? "awaiting_store_readiness"
            : "confirmed",
        paymentStatus: "authorized",
        courier: null,
        created: stamp(),
        trackingToken: secret(),
      };
      db.prepare("INSERT INTO bookings VALUES(?,?,?,?,?)").run(
        b.id,
        req.user.id,
        q.id,
        key,
        JSON.stringify(b),
      );
      db.prepare("INSERT INTO tracking VALUES(?,?,?)").run(
        hash(b.trackingToken),
        b.id,
        Date.now() + 30 * 86400000,
      );
      payment(b, "authorization", q.price.total);
      event(b, req.user.id, "booking_created", {
        unattended: b.delivery.unattended,
      });
      notify(
        b,
        `CoreRunner ${b.id} confirmed`,
        `Demo delivery saved. ${b.status === "awaiting_store_readiness" ? "Store readiness review is required before dispatch." : "Awaiting dispatch assignment."} Tracking: /?track=${b.trackingToken}`,
      );
      return { booking: present(b), reused: false };
    });
    res.status(result.reused ? 200 : 201).json(result);
  });
  app.get("/api/bookings", auth, (req, res) =>
    res.json({
      bookings: db
        .prepare("SELECT id FROM bookings WHERE user_id=? ORDER BY rowid DESC")
        .all(req.user.id)
        .map((r) => present(read(r.id))),
    }),
  );
  app.get("/api/bookings/:id", auth, (req, res) =>
    res.json({ booking: present(owned(req)) }),
  );
  app.get("/api/inbox", auth, (req, res) =>
    res.json({
      messages: db
        .prepare(
          "SELECT recipient,subject,body,created FROM notifications WHERE user_id=? ORDER BY id DESC",
        )
        .all(req.user.id),
    }),
  );
  app.get("/api/track/:token", (req, res) => {
    const t = db
      .prepare("SELECT booking_id FROM tracking WHERE token=? AND expires>?")
      .get(hash(req.params.token), Date.now());
    if (!t) fail(404, "Tracking link expired or not found.");
    const b = read(t.booking_id);
    res.json({
      id: b.id,
      status: b.status,
      service: b.delivery.service,
      courier: b.courier,
      events: db
        .prepare(
          "SELECT kind,created FROM events WHERE booking_id=? ORDER BY id",
        )
        .all(b.id),
      location: null,
      note: "Phone GPS and arrival estimates are not connected. This page shows backend status only.",
    });
  });
  app.post("/api/demo/dispatch-session", demoOnly, (req, res) => {
    const token = secret();
    db.prepare("INSERT INTO staff_sessions VALUES(?,?)").run(
      hash(token),
      Date.now() + 3600000,
    );
    cookie(res, "cr_staff", token, 3600000);
    res.json({ simulated: true });
  });
  app.get("/api/dispatch", staff, (req, res) =>
    res.json({
      bookings: db
        .prepare("SELECT id FROM bookings ORDER BY rowid DESC")
        .all()
        .map((r) => present(read(r.id))),
      couriers: db.prepare("SELECT * FROM couriers").all(),
    }),
  );
  app.post("/api/dispatch/:id/assign", staff, (req, res) => {
    const b = transaction(db, () => {
      const b = read(req.params.id);
      if (b.status !== "confirmed")
        fail(
          409,
          b.status === "awaiting_store_readiness"
            ? "Store readiness must be reviewed before dispatch."
            : "Only confirmed, unassigned deliveries can be assigned.",
        );
      const c = db
        .prepare("SELECT * FROM couriers WHERE id=?")
        .get(String(req.body.courierId));
      if (!c) fail(400, "Choose an approved courier.");
      const busy = db
        .prepare("SELECT payload FROM bookings")
        .all()
        .some((r) => {
          const p = JSON.parse(r.payload);
          return (
            p.courier?.id === c.id &&
            !["delivered", "returned", "cancelled"].includes(p.status)
          );
        });
      if (busy)
        fail(
          409,
          "This courier already has an active delivery and reserved return capacity.",
        );
      b.courier = c;
      b.status = "assigned";
      save(b);
      event(b, "demo-dispatch", "courier_assigned", {
        courierId: c.id,
        returnCapacityReserved: true,
      });
      notify(
        b,
        "Your CoreRunner courier is assigned",
        `${c.name} is assigned to ${b.id}.`,
      );
      return b;
    });
    res.json({ booking: present(b) });
  });
  app.post("/api/dispatch/:id/advance", staff, (req, res) => {
    const b = transaction(db, () => {
      const b = read(req.params.id);
      const target = req.body.status;
      const allowed = {
        assigned: ["heading_to_pickup"],
        heading_to_pickup: ["picked_up"],
        picked_up: ["heading_to_delivery"],
        heading_to_delivery: ["handoff_failed"],
        handoff_failed: ["returning"],
        returning: ["returned"],
      };
      if (!allowed[b.status]?.includes(target))
        fail(409, "That status change is not allowed.");
      if (target === "handoff_failed" && b.delivery.unattended)
        fail(
          409,
          "This booking allows unattended delivery. A missing signature is not a valid failure reason.",
        );
      if (target === "returned")
        text(req.body.receivedBy, "Return recipient", 100);
      b.status = target;
      if (target === "picked_up") {
        b.paymentStatus = "captured";
        payment(b, "capture", b.price.total);
      }
      if (target === "handoff_failed")
        b.returnReason = "Recipient unavailable for signature or PIN";
      if (target === "returned") {
        payment(b, "return_charge", b.price.returnTotal);
        b.returnReceivedBy = req.body.receivedBy;
      }
      save(b);
      event(
        b,
        "demo-dispatch",
        target,
        target === "returned" ? { receivedBy: b.returnReceivedBy } : {},
      );
      notify(
        b,
        `CoreRunner ${b.id}: ${target.replaceAll("_", " ")}`,
        "Demo status updated. See the delivery record for details.",
      );
      return b;
    });
    res.json({ booking: present(b) });
  });
  // This first slice deliberately has no generic "mark delivered" endpoint: proof-of-delivery comes next.
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Endpoint not found." }),
  );
  app.use((error, req, res, next) => {
    if (error instanceof Problem)
      return res.status(error.status).json({ error: error.message });
    if (error instanceof SyntaxError && error.status === 400)
      return res.status(400).json({ error: "Invalid JSON." });
    console.error(error);
    res.status(500).json({ error: "Unexpected server error. Please retry." });
  });
  return { app, db };
}
