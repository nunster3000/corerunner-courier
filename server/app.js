import { scheduler, easternClock } from "./scheduling.js";
import { installCancellations } from "./cancellations.js";
import { syncSimulation, trackingView, changeSimulation } from "./tracking.js";
import { installGroceries, requireCurrentReadiness } from "./groceries.js";
import { installCorey } from "./corey.js";
import express from "express";
import { randomBytes, randomUUID, createHash, randomInt } from "node:crypto";
import { openDatabase, transaction } from "./db.js";
import { validateSignature, normalizePhoto } from "./proof.js";
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
  aiProvider = null,
  coreyMode = "mock",
  scheduleNow = () => new Date(),
} = {}) {
  const app = express(),
    db = openDatabase(dbPath);
  const scheduling = scheduler(db, scheduleNow);
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
  app.use(express.json({ limit: "6mb" }));
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
  const courier = (req, res, next) => {
    const c = db
      .prepare(
        "SELECT c.* FROM courier_sessions s JOIN couriers c ON c.id=s.courier_id WHERE s.token=? AND s.expires>?",
      )
      .get(hash(cookies(req).cr_courier), Date.now());
    if (!c)
      return res
        .status(403)
        .json({ error: "Open a demo courier session first." });
    req.courier = c;
    next();
  };
  const assigned = (req) => {
    const b = read(req.params.id);
    if (b.courier?.id !== req.courier.id)
      fail(404, "This delivery is not assigned to you.");
    return b;
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
    syncSimulation(b);
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
  const notify = (b, subject, body, recipients) => {
    const u = db.prepare("SELECT email FROM users WHERE id=?").get(b.userId);
    for (const recipient of new Set(
      recipients || [u.email, b.delivery.recipientEmail],
    ))
      db.prepare(
        "INSERT INTO notifications(user_id,recipient,subject,body,created) VALUES(?,?,?,?,?)",
      ).run(b.userId, recipient, subject, body, stamp());
  };
  const ensurePin = (b) => {
    if (db.prepare("SELECT 1 FROM handoff_codes WHERE booking_id=?").get(b.id))
      return;
    const pin = String(randomInt(100000, 1000000));
    db.prepare(
      "INSERT INTO handoff_codes(booking_id,code_hash) VALUES(?,?)",
    ).run(b.id, hash(b.id + ":" + pin));
    notify(
      b,
      `Delivery PIN for ${b.id}`,
      `Your handoff PIN is ${pin}. Share it with your courier only when you receive the package. Demo email; nothing was sent.`,
      [b.delivery.recipientEmail],
    );
  };
  const proofSummary = (id) =>
    db
      .prepare(
        "SELECT id,leg,method,created FROM proofs WHERE booking_id=? ORDER BY created",
      )
      .all(id);
  const present = (b) => ({
    ...b,
    tracking: trackingView(b),
    proofs: proofSummary(b.id),
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
  installCancellations(app, {
    db,
    auth,
    staff,
    owned,
    read,
    save,
    present,
    event,
    payment,
    notify,
  });
  installGroceries(app, {
    db,
    auth,
    staff,
    read,
    owned,
    save,
    present,
    event,
    notify,
    canRead: (req, b) => {
      const cs = cookies(req);
      const u = db
        .prepare("SELECT user_id FROM sessions WHERE token=? AND expires>?")
        .get(hash(cs.cr_session), Date.now());
      return (
        u?.user_id === b.userId ||
        !!db
          .prepare("SELECT 1 FROM staff_sessions WHERE token=? AND expires>?")
          .get(hash(cs.cr_staff), Date.now())
      );
    },
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
  const createQuote = (userId, input) => {
    const d = delivery(input),
      q = {
        id: randomUUID(),
        delivery: d,
        price: price(d),
        schedule: scheduling.plan(d),
        expires: Date.now() + 15 * 60000,
      };
    db.prepare("INSERT INTO quotes VALUES(?,?,?,?)").run(
      q.id,
      userId,
      JSON.stringify(q),
      q.expires,
    );
    return q;
  };
  installCorey(app, {
    provider: aiProvider,
    mock: coreyMode === "mock" && !aiProvider,
    getUser: (req) =>
      db
        .prepare(
          "SELECT u.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
        )
        .get(hash(cookies(req).cr_session), Date.now()),
    createQuote,
    listBookings: (userId) =>
      db
        .prepare(
          "SELECT id,payload FROM bookings WHERE user_id=? ORDER BY rowid DESC LIMIT 10",
        )
        .all(userId)
        .map((r) => {
          const b = JSON.parse(r.payload);
          return {
            id: r.id,
            status: b.status,
            service: b.delivery.service,
            created: b.created,
          };
        }),
  });
  app.post("/api/quotes", auth, (req, res) =>
    res.status(201).json(createQuote(req.user.id, req.body)),
  );
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
      const schedule = scheduling.plan(q.delivery);
      const b = {
        id: "CR-" + randomBytes(5).toString("hex").toUpperCase(),
        userId: req.user.id,
        quoteId: q.id,
        delivery: q.delivery,
        schedule,
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
      ensurePin(b);
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
      location: trackingView(b).location,
      tracking: trackingView(b),
      note: trackingView(b).note,
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
  app.get("/api/availability", (req, res) =>
    res.json(
      scheduling.availability(
        String(req.query.date || easternClock(scheduleNow()).date),
      ),
    ),
  );
  app.get("/api/dispatch/schedule", staff, (req, res) =>
    res.json(
      scheduling.board(
        String(req.query.date || easternClock(scheduleNow()).date),
      ),
    ),
  );
  app.post("/api/dispatch/shifts/:courierId", staff, (req, res) =>
    res.json(scheduling.updateShift(req.params.courierId, req.body)),
  );
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
      requireCurrentReadiness(b);
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
      const schedule = scheduling.assignment(b, c.id);
      if (schedule) b.schedule = schedule;
      ensurePin(b);
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
  // Both operator and courier status actions use the same transition rules.
  function advance(req, res, asCourier) {
    const b = transaction(db, () => {
      const b = asCourier ? assigned(req) : read(req.params.id);
      const actor = asCourier ? req.courier.id : "demo-dispatch",
        target = req.body.status;
      const allowed = {
        assigned: ["heading_to_pickup"],
        heading_to_pickup: ["picked_up"],
        picked_up: ["heading_to_delivery"],
        heading_to_delivery: ["handoff_failed"],
        handoff_failed: ["returning"],
        return_scheduled: ["returning"],
      };
      if (!allowed[b.status]?.includes(target))
        fail(
          409,
          "That status change is not allowed. Delivery and return completion require proof.",
        );
      if (target === "handoff_failed" && b.delivery.unattended)
        fail(
          409,
          "This booking allows unattended delivery. A missing signature is not a valid failure reason.",
        );
      if (target === "heading_to_pickup" && b.schedule) {
        const clock = easternClock(scheduleNow());
        if (
          clock.date !== b.schedule.date ||
          clock.minute < b.schedule.startMinute ||
          clock.minute + 2 * price(b.delivery).minutes + 30 >
            b.schedule.endMinute
        )
          fail(
            409,
            "This pickup does not fit the reserved delivery and return window. Dispatch review is required.",
          );
      }
      b.status = target;
      if (target === "picked_up") {
        b.paymentStatus = "captured";
        payment(b, "capture", b.price.total);
      }
      if (target === "handoff_failed") {
        b.returnReason = "Recipient unavailable for signature or PIN";
        b.status = "return_scheduled";
        b.returnDueDate = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/New_York",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
        event(b, actor, "handoff_failed", { reason: b.returnReason });
      }
      save(b);
      event(b, actor, b.status, {
        ...(target === "returning" ? { authorizationWindowClosed: true } : {}),
      });
      notify(
        b,
        `CoreRunner ${b.id}: ${b.status.replaceAll("_", " ")}`,
        target === "handoff_failed"
          ? "A handoff was attempted but no recipient was available. Same-day return is scheduled with the assigned courier. No wait is required."
          : "Demo status updated. See your delivery for details.",
      );
      return b;
    });
    res.json({ booking: present(b) });
  }
  app.post("/api/dispatch/:id/advance", staff, (req, res) =>
    advance(req, res, false),
  );
  app.get("/api/demo/couriers", demoOnly, (req, res) =>
    res.json({ couriers: db.prepare("SELECT * FROM couriers").all() }),
  );
  app.post("/api/demo/courier-session", demoOnly, (req, res) => {
    const c = db
      .prepare("SELECT * FROM couriers WHERE id=?")
      .get(String(req.body.courierId));
    if (!c) fail(400, "Choose an approved courier.");
    const token = secret();
    db.prepare("INSERT INTO courier_sessions VALUES(?,?,?)").run(
      hash(token),
      c.id,
      Date.now() + 3600000,
    );
    cookie(res, "cr_courier", token, 3600000);
    res.json({ courier: c, simulated: true });
  });
  app.get("/api/courier", courier, (req, res) =>
    res.json({
      courier: req.courier,
      bookings: db
        .prepare("SELECT id FROM bookings ORDER BY rowid DESC")
        .all()
        .map((r) => read(r.id))
        .filter((b) => b.courier?.id === req.courier.id)
        .map((b) => {
          const { trackingToken, userId, quoteId, price, payments, ...job } =
            present(b);
          return job;
        }),
    }),
  );
  app.post("/api/courier/:id/simulation", courier, (req, res) => {
    const b = transaction(db, () => {
      const b = assigned(req);
      changeSimulation(b, req.body);
      save(b);
      return b;
    });
    res.json({ tracking: trackingView(b) });
  });
  app.post("/api/courier/:id/advance", courier, (req, res) =>
    advance(req, res, true),
  );
  app.post("/api/courier/:id/contact-sender", courier, (req, res) => {
    const b = transaction(db, () => {
      const b = assigned(req);
      if (
        b.returnOnly ||
        !["handoff_failed", "return_scheduled"].includes(b.status)
      )
        fail(
          409,
          "Sender authorization is available only before a failed handoff return begins.",
        );
      if (!b.contactRequested) {
        b.contactRequested = stamp();
        save(b);
        event(b, req.courier.id, "sender_contact_requested");
        const u = db
          .prepare("SELECT email FROM users WHERE id=?")
          .get(b.userId);
        notify(
          b,
          `Your authorization is requested for ${b.id}`,
          "Your courier has optionally requested unattended delivery. Sign in to My deliveries to authorize it. The courier can start the same-day return without waiting.",
          [u.email],
        );
      }
      return b;
    });
    res.json({ ok: true, contactRequested: b.contactRequested });
  });
  app.post("/api/bookings/:id/unattended", auth, (req, res) => {
    const b = transaction(db, () => {
      const b = owned(req);
      if (b.returnOnly)
        fail(
          409,
          "This package is committed to return; unattended delivery is unavailable.",
        );
      if (req.body.authorize !== true)
        fail(400, "Explicit sender authorization is required.");
      if (
        !["heading_to_delivery", "handoff_failed", "return_scheduled"].includes(
          b.status,
        )
      )
        fail(
          409,
          "Authorization is no longer available. The return may already be underway.",
        );
      if (!b.delivery.unattended) {
        b.delivery.unattended = true;
        b.unattendedAuthorizedAt = stamp();
        b.unattendedAuthorizedBy = req.user.id;
        save(b);
        event(b, req.user.id, "unattended_authorized");
        notify(
          b,
          `Unattended delivery authorized for ${b.id}`,
          "The sender authorized a photo-confirmed drop-off. The courier must still confirm a suitable location. A return remains available if drop-off is not possible.",
        );
      }
      return b;
    });
    res.json({ booking: present(b) });
  });
  app.post("/api/courier/:id/complete", courier, async (req, res) => {
    assigned(req);
    const key = text(req.get("Idempotency-Key"), "Idempotency key", 100),
      method = req.body.method,
      leg = req.body.leg;
    if (!["delivery", "return"].includes(leg))
      fail(400, "Choose delivery or return proof.");
    if (
      !["pin", "signature", "photo"].includes(method) ||
      (leg === "return" && method !== "signature")
    )
      fail(400, "Return handoff requires the receiving person’s signature.");
    const earlier = db
      .prepare("SELECT * FROM proofs WHERE booking_id=? AND request_key=?")
      .get(req.params.id, key);
    if (earlier) {
      if (earlier.leg !== leg || earlier.method !== method)
        fail(409, "Request key already used for different proof.");
      return res.json({ booking: present(assigned(req)), reused: true });
    }
    let payload = {},
      image = null;
    if (method === "signature") payload = validateSignature(req.body);
    if (method === "photo") {
      if (req.body.safeLocation !== true)
        fail(
          400,
          "Confirm that the package is at a suitable drop-off location.",
        );
      image = await normalizePhoto(req.body.photo);
      payload = { safeLocation: true };
    }
    const result = transaction(db, () => {
      const b = assigned(req);
      const existing = db
        .prepare("SELECT * FROM proofs WHERE booking_id=? AND request_key=?")
        .get(b.id, key);
      if (existing) {
        if (existing.leg !== leg || existing.method !== method)
          fail(409, "Request key already used for different proof.");
        return { booking: present(b), reused: true };
      }
      const canDeliver =
        !b.returnOnly &&
        (b.status === "heading_to_delivery" ||
          (["return_scheduled", "handoff_failed"].includes(b.status) &&
            b.delivery.unattended &&
            method === "photo"));
      if (
        (leg === "delivery" && !canDeliver) ||
        (leg === "return" && b.status !== "returning")
      )
        fail(
          409,
          "This handoff is not available in the current delivery state. Refresh your job.",
        );
      if (leg === "delivery" && method === "photo" && !b.delivery.unattended)
        fail(403, "Only the sender can authorize unattended delivery.");
      if (method === "pin") {
        const code = db
          .prepare("SELECT * FROM handoff_codes WHERE booking_id=?")
          .get(b.id);
        if (!code || code.used)
          fail(
            409,
            "The handoff PIN is unavailable. Use a recipient signature.",
          );
        if (code.blocked_until > Date.now())
          return {
            error:
              "Too many incorrect PIN attempts. Wait five minutes or capture a signature.",
            status: 429,
          };
        if (
          !/^\d{6}$/.test(String(req.body.pin || "")) ||
          hash(b.id + ":" + req.body.pin) !== code.code_hash
        ) {
          const attempts = code.blocked_until ? 1 : code.attempts + 1;
          db.prepare(
            "UPDATE handoff_codes SET attempts=?,blocked_until=? WHERE booking_id=?",
          ).run(attempts, attempts >= 5 ? Date.now() + 300000 : 0, b.id);
          return {
            error:
              attempts >= 5
                ? "Too many incorrect PIN attempts. Wait five minutes or capture a signature."
                : "The PIN did not match. Ask the recipient to check it.",
            status: attempts >= 5 ? 429 : 400,
          };
        }
      }
      const proofId = randomUUID(),
        created = stamp();
      db.prepare("INSERT INTO proofs VALUES(?,?,?,?,?,?,?,?,?)").run(
        proofId,
        b.id,
        leg,
        method,
        req.courier.id,
        created,
        JSON.stringify(payload),
        image,
        key,
      );
      if (leg === "return") {
        b.status = "returned";
        b.returnReceivedBy = payload.signer;
        payment(
          b,
          b.returnFeeOverride === 0 ? "return_fee_waived" : "return_charge",
          b.returnFeeOverride ?? b.price.returnTotal,
        );
      } else {
        b.status = "delivered";
        b.deliveredAt = created;
      }
      db.prepare("UPDATE handoff_codes SET used=1 WHERE booking_id=?").run(
        b.id,
      );
      save(b);
      event(b, req.courier.id, b.status, { proofId, method, leg });
      notify(
        b,
        `CoreRunner ${b.id}: ${b.status}`,
        `Handoff recorded with ${method === "pin" ? "a recipient PIN" : method === "photo" ? "a delivery photo" : "a recipient signature"}. ${leg === "return" ? (b.returnFeeOverride === 0 ? "The return fee was waived for a company-caused failure." : "The disclosed return distance and time charge has been recorded.") : ""}`,
      );
      return { booking: present(b), reused: false };
    });
    if (result.error)
      return res.status(result.status).json({ error: result.error });
    res.json(result);
  });
  app.get("/api/bookings/:id/proofs/:proofId", (req, res) => {
    const b = read(req.params.id),
      cs = cookies(req);
    const user = db
      .prepare("SELECT user_id FROM sessions WHERE token=? AND expires>?")
      .get(hash(cs.cr_session), Date.now());
    const isStaff = db
      .prepare("SELECT 1 FROM staff_sessions WHERE token=? AND expires>?")
      .get(hash(cs.cr_staff), Date.now());
    const c = db
      .prepare(
        "SELECT courier_id FROM courier_sessions WHERE token=? AND expires>?",
      )
      .get(hash(cs.cr_courier), Date.now());
    if (
      user?.user_id !== b.userId &&
      !isStaff &&
      (!c || c.courier_id !== b.courier?.id)
    )
      fail(404, "Proof not found.");
    const proof = db
      .prepare("SELECT * FROM proofs WHERE id=? AND booking_id=?")
      .get(req.params.proofId, b.id);
    if (!proof) fail(404, "Proof not found.");
    if (req.query.image === "1") {
      if (!proof.image) fail(404, "Photo not found.");
      return res.type("image/webp").send(Buffer.from(proof.image));
    }
    res.json({
      id: proof.id,
      leg: proof.leg,
      method: proof.method,
      created: proof.created,
      ...JSON.parse(proof.payload),
    });
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Endpoint not found." }),
  );
  app.use((error, req, res, next) => {
    if (error instanceof Problem)
      return res.status(error.status).json({ error: error.message });
    if (error.type === "entity.too.large")
      return res
        .status(413)
        .json({ error: "Photo request is too large. Use a photo under 4 MB." });
    if (error instanceof SyntaxError && error.status === 400)
      return res.status(400).json({ error: "Invalid JSON." });
    console.error(error);
    res.status(500).json({ error: "Unexpected server error. Please retry." });
  });
  return { app, db };
}
