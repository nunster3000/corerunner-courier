import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createApp } from "./app.js";
import sharp from "sharp";
const sample = {
  name: "Alex Test",
  email: "alex@example.com",
  phone: "4045550123",
  pickup: "100 Sample Street, Atlanta 30303",
  dropoff: "200 Example Lane, Decatur 30030",
  recipient: "Jamie Test",
  recipientEmail: "jamie@example.com",
  item: "Everyday package",
  weight: 10,
  service: "Same-day",
  unattended: false,
};
async function fixture(t, options = {}) {
  const { app, db } = createApp({
    dbPath: ":memory:",
    scheduleNow: () =>
      new Date(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/New_York",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()) + "T16:00:00Z",
      ),
    ...options,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    db.close();
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  function client() {
    const jar = {};
    return async (path, body, headers = {}) => {
      const r = await fetch(url + "/api" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: Object.entries(jar)
            .map(([k, v]) => `${k}=${v}`)
            .join("; "),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      for (const c of r.headers.getSetCookie()) {
        const pair = c.split(";")[0],
          i = pair.indexOf("=");
        jar[pair.slice(0, i)] = pair.slice(i + 1);
      }
      return { status: r.status, body: await r.json() };
    };
  }
  return { client, db };
}
async function login(c, email = sample.email) {
  assert.equal((await c("/auth/request", { ...sample, email })).status, 200);
  const inbox = await c("/auth/inbox");
  assert.equal(
    (await c("/auth/verify", { token: inbox.body.token })).status,
    200,
  );
  return inbox.body.token;
}
async function book(c, overrides = {}) {
  const q = await c("/quotes", { ...sample, ...overrides });
  assert.equal(q.status, 201);
  const b = await c(
    "/bookings",
    { quoteId: q.body.id, accepted: true },
    { "Idempotency-Key": randomUUID() },
  );
  assert.equal(b.status, 201);
  return b.body.booking;
}
test("identity challenge is browser-bound, single-use and session-backed", async (t) => {
  const { client } = await fixture(t),
    a = client(),
    b = client();
  assert.equal((await a("/quotes", sample)).status, 401);
  await a("/auth/request", sample);
  assert.equal((await b("/auth/inbox")).status, 404);
  const { body } = await a("/auth/inbox");
  assert.equal((await b("/auth/verify", { token: body.token })).status, 400);
  assert.equal((await a("/auth/verify", { token: body.token })).status, 200);
  assert.equal((await a("/auth/verify", { token: body.token })).status, 400);
  assert.equal((await a("/me")).body.user.email, sample.email);
  await a("/logout", {});
  assert.equal((await a("/me")).status, 401);
});
test("backend rejects invalid package, unknown service area and past date; ignores client totals", async (t) => {
  const { client } = await fixture(t),
    c = client();
  await login(c);
  for (const invalid of [
    { weight: 51 },
    { weight: 0 },
    { weight: "bad" },
    { pickup: "900 Ocean Drive, Miami" },
    { service: "Scheduled", date: "2000-01-01", window: "8–10 a.m." },
    { service: "Scheduled", date: "2027-02-30", window: "8–10 a.m." },
  ])
    assert.equal((await c("/quotes", { ...sample, ...invalid })).status, 400);
  const q = await c("/quotes", { ...sample, total: 1, returnTotal: 0 });
  assert.equal(q.status, 201);
  assert.equal(q.body.price.base, 500);
  assert.ok(q.body.price.total > 500);
});
test("booking transaction prevents duplicate charges and cannot use another account quote", async (t) => {
  const { client, db } = await fixture(t),
    a = client(),
    b = client();
  await login(a);
  await login(b, "other@example.com");
  const q = (await a("/quotes", sample)).body;
  assert.equal(
    (
      await b(
        "/bookings",
        { quoteId: q.id, accepted: true },
        { "Idempotency-Key": "foreign" },
      )
    ).status,
    404,
  );
  const body = { quoteId: q.id, accepted: true },
    headers = { "Idempotency-Key": "same-request" };
  assert.equal(
    (await a("/bookings", { ...body, accepted: false }, headers)).status,
    400,
  );
  const responses = await Promise.all([
    a("/bookings", body, headers),
    a("/bookings", body, headers),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 201]);
  const id = responses[0].body.booking.id;
  assert.equal(db.prepare("SELECT count(*) AS n FROM bookings").get().n, 1);
  assert.equal(db.prepare("SELECT count(*) AS n FROM payments").get().n, 1);
  assert.equal((await b("/bookings/" + id)).status, 404);
  assert.equal(
    (await a("/dispatch/" + id + "/assign", { courierId: "cr-01" })).status,
    403,
  );
});
test("decline creates no booking; expired quote cannot create authorization", async (t) => {
  const { client, db } = await fixture(t),
    c = client();
  await login(c);
  const q = (await c("/quotes", sample)).body;
  assert.equal(
    (
      await c(
        "/bookings",
        { quoteId: q.id, accepted: true, paymentOutcome: "decline" },
        { "Idempotency-Key": "decline" },
      )
    ).status,
    402,
  );
  assert.equal(db.prepare("SELECT count(*) AS n FROM payments").get().n, 0);
  db.prepare("UPDATE quotes SET expires=0 WHERE id=?").run(q.id);
  assert.equal(
    (
      await c(
        "/bookings",
        { quoteId: q.id, accepted: true },
        { "Idempotency-Key": "expired" },
      )
    ).status,
    409,
  );
});
test("grocery readiness blocks dispatch and courier cannot be assigned twice", async (t) => {
  const { client } = await fixture(t),
    c = client();
  await login(c);
  const g = await book(c, { item: "Groceries" }),
    a = await book(c),
    b = await book(c);
  await c("/demo/dispatch-session", {});
  assert.equal(
    (await c(`/dispatch/${g.id}/assign`, { courierId: "cr-01" })).status,
    409,
  );
  assert.equal(
    (await c(`/dispatch/${a.id}/assign`, { courierId: "cr-01" })).status,
    200,
  );
  assert.equal(
    (await c(`/dispatch/${b.id}/assign`, { courierId: "cr-01" })).status,
    409,
  );
});
test("pickup captures once, return has no second pickup fee, tracking omits private fields", async (t) => {
  const { client, db } = await fixture(t),
    c = client(),
    recipient = client();
  await login(c);
  const b = await book(c);
  await c("/demo/dispatch-session", {});
  await c(`/dispatch/${b.id}/assign`, { courierId: "cr-01" });
  assert.equal(
    (await c(`/dispatch/${b.id}/advance`, { status: "delivered" })).status,
    409,
  );
  for (const status of ["heading_to_pickup", "picked_up"])
    assert.equal(
      (await c(`/dispatch/${b.id}/advance`, { status })).status,
      200,
    );
  assert.equal(
    (await c(`/dispatch/${b.id}/advance`, { status: "picked_up" })).status,
    409,
  );
  for (const status of ["heading_to_delivery", "handoff_failed", "returning"])
    assert.equal(
      (await c(`/dispatch/${b.id}/advance`, { status })).status,
      200,
    );
  assert.equal(
    (await c(`/dispatch/${b.id}/advance`, { status: "returned" })).status,
    409,
  );
  await c("/demo/courier-session", { courierId: "cr-01" });
  const returned = await c(
    `/courier/${b.id}/complete`,
    { leg: "return", method: "signature", ...signature },
    { "Idempotency-Key": "signed-return" },
  );
  assert.equal(returned.status, 200);
  assert.equal(
    returned.body.booking.payments.find((p) => p.kind === "return_charge")
      .amount,
    b.price.distance + b.price.time,
  );
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM payments WHERE kind='capture'").get()
      .n,
    1,
  );
  const track = await recipient("/track/" + b.trackingToken);
  assert.equal(track.status, 200);
  assert.equal(track.body.status, "returned");
  for (const key of [
    "delivery",
    "price",
    "userId",
    "recipientEmail",
    "trackingToken",
  ])
    assert.equal(track.body[key], undefined);
  assert.equal((await recipient("/bookings/" + b.id)).status, 401);
});
test("records persist on database reopen", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "corerunner-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "store.sqlite");
  const { client } = await fixture(t, { dbPath: path }),
    c = client();
  await login(c);
  const b = await book(c);
  const { db: second } = createApp({ dbPath: path });
  try {
    assert.equal(
      second.prepare("SELECT id FROM bookings WHERE id=?").get(b.id).id,
      b.id,
    );
    assert.equal(second.prepare("SELECT count(*) AS n FROM events").get().n, 1);
  } finally {
    second.close();
  }
});
test("external browser writes rejected; demo auth and staff access can be disabled", async (t) => {
  const { client } = await fixture(t),
    c = client();
  assert.equal(
    (await c("/auth/request", sample, { Origin: "https://untrusted.example" }))
      .status,
    403,
  );
  const f = await fixture(t, { demo: false }),
    disabled = f.client();
  assert.equal((await disabled("/auth/request", sample)).status, 404);
  assert.equal((await disabled("/demo/dispatch-session", {})).status, 404);
});

const signature = {
  signer: "Jamie Test",
  consent: true,
  strokes: [
    [
      [0.1, 0.2],
      [0.2, 0.5],
      [0.3, 0.2],
      [0.5, 0.6],
    ],
  ],
};
async function prepared(t, overrides = {}) {
  const f = await fixture(t),
    sender = f.client(),
    courier = f.client(),
    other = f.client();
  await login(sender);
  const b = await book(sender, overrides);
  await sender("/demo/dispatch-session", {});
  await sender(`/dispatch/${b.id}/assign`, { courierId: "cr-01" });
  await courier("/demo/courier-session", { courierId: "cr-01" });
  await other("/demo/courier-session", { courierId: "cr-02" });
  for (const status of [
    "heading_to_pickup",
    "picked_up",
    "heading_to_delivery",
  ])
    assert.equal(
      (await courier(`/courier/${b.id}/advance`, { status })).status,
      200,
    );
  return { ...f, sender, courier, other, b };
}
async function image() {
  const png = await sharp({
    create: { width: 60, height: 40, channels: 3, background: "#2450d8" },
  })
    .png()
    .toBuffer();
  return "data:image/png;base64," + png.toString("base64");
}
async function pinFor(sender, id) {
  const messages = (await sender("/inbox")).body.messages;
  return messages
    .find((m) => m.subject === `Delivery PIN for ${id}`)
    .body.match(/PIN is (\d{6})/)[1];
}
test("only assigned courier can complete a handoff and valid PIN produces one proof", async (t) => {
  const { sender, courier, other, client, b, db } = await prepared(t);
  const pin = await pinFor(sender, b.id),
    body = { leg: "delivery", method: "pin", pin },
    headers = { "Idempotency-Key": "pin-handoff" };
  assert.equal(
    (await other(`/courier/${b.id}/complete`, body, headers)).status,
    404,
  );
  assert.equal(
    (await sender(`/courier/${b.id}/complete`, body, headers)).status,
    403,
  );
  assert.equal(
    (
      await courier(
        `/courier/${b.id}/complete`,
        { ...body, pin: "000000" },
        headers,
      )
    ).status,
    400,
  );
  const r = await courier(`/courier/${b.id}/complete`, body, headers);
  assert.equal(r.status, 200);
  assert.equal(r.body.booking.status, "delivered");
  assert.equal(
    (await courier(`/courier/${b.id}/complete`, body, headers)).body.reused,
    true,
  );
  assert.equal(db.prepare("SELECT count(*) AS n FROM proofs").get().n, 1);
  const id = r.body.booking.proofs[0].id;
  assert.equal((await client()(`/bookings/${b.id}/proofs/${id}`)).status, 404);
  assert.equal((await other(`/bookings/${b.id}/proofs/${id}`)).status, 404);
  assert.equal(
    (await sender(`/bookings/${b.id}/proofs/${id}`)).body.method,
    "pin",
  );
  const tracking = (await client()("/track/" + b.trackingToken)).body;
  assert.equal(tracking.status, "delivered");
  assert.equal(tracking.location, null);
  assert.equal(tracking.tracking.active, false);
  assert.equal(tracking.proofs, undefined);
  assert.equal(tracking.pin, undefined);
});
test("PIN lockout persists and a signature remains available without bypassing proof", async (t) => {
  const { sender, courier, b, db } = await prepared(t);
  const body = { leg: "delivery", method: "pin", pin: "000000" },
    headers = { "Idempotency-Key": "locked" };
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await courier(`/courier/${b.id}/complete`, body, headers)).status,
      i === 4 ? 429 : 400,
    );
  assert.equal(
    (
      await courier(
        `/courier/${b.id}/complete`,
        { ...body, pin: await pinFor(sender, b.id) },
        headers,
      )
    ).status,
    429,
  );
  assert.equal(
    db
      .prepare("SELECT attempts FROM handoff_codes WHERE booking_id=?")
      .get(b.id).attempts,
    5,
  );
  assert.equal(
    (
      await courier(
        `/courier/${b.id}/complete`,
        { leg: "delivery", method: "signature", ...signature, strokes: [] },
        { "Idempotency-Key": "empty" },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await courier(
        `/courier/${b.id}/complete`,
        { leg: "delivery", method: "signature", ...signature, consent: false },
        { "Idempotency-Key": "consent" },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await courier(
        `/courier/${b.id}/complete`,
        { leg: "delivery", method: "signature", ...signature },
        { "Idempotency-Key": "signature" },
      )
    ).body.booking.status,
    "delivered",
  );
});
test("photo completion needs sender authorization and valid image bytes", async (t) => {
  const { sender, courier, b, db } = await prepared(t);
  const photo = await image(),
    headers = { "Idempotency-Key": "photo" };
  const body = { leg: "delivery", method: "photo", photo, safeLocation: true };
  assert.equal(
    (await courier(`/courier/${b.id}/complete`, body, headers)).status,
    403,
  );
  assert.equal(
    (await courier(`/bookings/${b.id}/unattended`, { authorize: true })).status,
    401,
  );
  assert.equal(
    (await sender(`/bookings/${b.id}/unattended`, { authorize: false })).status,
    400,
  );
  await sender(`/bookings/${b.id}/unattended`, { authorize: true });
  assert.equal(
    (
      await courier(
        `/courier/${b.id}/complete`,
        { ...body, photo: "data:image/png;base64,aGVsbG8=" },
        headers,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await courier(
        `/courier/${b.id}/complete`,
        { ...body, safeLocation: false },
        headers,
      )
    ).status,
    400,
  );
  const results = await Promise.all([
    courier(`/courier/${b.id}/complete`, body, headers),
    courier(`/courier/${b.id}/complete`, body, headers),
  ]);
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(db.prepare("SELECT count(*) AS n FROM proofs").get().n, 1);
  const proof = db
    .prepare("SELECT image FROM proofs WHERE booking_id=?")
    .get(b.id);
  const meta = await sharp(Buffer.from(proof.image)).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.exif, undefined);
});
test("failed handoff schedules immediate return; optional sender consent permits photo completion without return fee", async (t) => {
  const { sender, courier, b, db } = await prepared(t);
  const failed = await courier(`/courier/${b.id}/advance`, {
    status: "handoff_failed",
  });
  assert.equal(failed.body.booking.status, "return_scheduled");
  assert.ok(failed.body.booking.returnDueDate);
  await courier(`/courier/${b.id}/contact-sender`, {});
  await courier(`/courier/${b.id}/contact-sender`, {});
  assert.equal(
    db
      .prepare(
        "SELECT count(*) AS n FROM events WHERE kind='sender_contact_requested'",
      )
      .get().n,
    1,
  );
  const authorized = await sender(`/bookings/${b.id}/unattended`, {
    authorize: true,
  });
  assert.equal(authorized.body.booking.delivery.unattended, true);
  const result = await courier(
    `/courier/${b.id}/complete`,
    {
      leg: "delivery",
      method: "photo",
      photo: await image(),
      safeLocation: true,
    },
    { "Idempotency-Key": "after-failure" },
  );
  assert.equal(result.body.booking.status, "delivered");
  assert.equal(
    db
      .prepare("SELECT count(*) AS n FROM payments WHERE kind='return_charge'")
      .get().n,
    0,
  );
});
test("return beginning closes authorization and signed return charges only once", async (t) => {
  const { sender, courier, b, db } = await prepared(t);
  await courier(`/courier/${b.id}/advance`, { status: "handoff_failed" });
  assert.equal(
    (await courier(`/courier/${b.id}/advance`, { status: "returning" })).status,
    200,
  );
  assert.equal(
    (await sender(`/bookings/${b.id}/unattended`, { authorize: true })).status,
    409,
  );
  assert.equal(
    (await courier(`/courier/${b.id}/contact-sender`, {})).status,
    409,
  );
  assert.equal(
    (
      await courier(
        `/courier/${b.id}/complete`,
        { leg: "delivery", method: "signature", ...signature },
        { "Idempotency-Key": "wrong-leg" },
      )
    ).status,
    409,
  );
  const body = { leg: "return", method: "signature", ...signature },
    headers = { "Idempotency-Key": "return" };
  assert.equal(
    (await courier(`/courier/${b.id}/complete`, body, headers)).body.booking
      .status,
    "returned",
  );
  assert.equal(
    (await courier(`/courier/${b.id}/complete`, body, headers)).body.reused,
    true,
  );
  assert.equal(
    db
      .prepare(
        "SELECT amount FROM payments WHERE booking_id=? AND kind='return_charge'",
      )
      .get(b.id).amount,
    b.price.returnTotal,
  );
  assert.equal(
    db
      .prepare("SELECT count(*) AS n FROM payments WHERE kind='return_charge'")
      .get().n,
    1,
  );
  const second = await book(sender);
  assert.equal(
    (await sender(`/dispatch/${second.id}/assign`, { courierId: "cr-01" }))
      .status,
    200,
  );
});

const aiText = (text) => [
  {
    type: "message",
    role: "assistant",
    content: [{ type: "output_text", text }],
  },
];
const aiCall = (name, args = {}) => [
  {
    type: "function_call",
    call_id: randomUUID(),
    name,
    arguments: JSON.stringify(args),
  },
];
test("Corey is explicitly unavailable without a provider", async (t) => {
  const { client } = await fixture(t, { aiProvider: null, coreyMode: "live" });
  const c = client();
  assert.equal((await c("/corey/status")).body.available, false);
  assert.equal((await c("/corey/message", { message: "Hello" })).status, 503);
});
test("Corey prepares an authoritative quote but cannot book or grant unattended consent", async (t) => {
  let count = 0;
  const provider = async (input) => {
    count++;
    if (count === 1)
      return aiCall(
        "update_delivery_draft",
        Object.fromEntries(
          Object.entries(sample)
            .filter(([k]) => k !== "unattended")
            .map(([k, v]) => [k, String(v)]),
        ),
      );
    if (count === 2) return aiCall("prepare_quote");
    if (count === 3)
      return aiCall("book_delivery", {
        accepted: true,
        unattended: true,
        total: 1,
      });
    assert.match(input.at(-1).output, /Unsupported tool/);
    return aiText("Review and confirm your quote.");
  };
  const { client, db } = await fixture(t, { aiProvider: provider });
  const c = client();
  await login(c);
  const r = await c("/corey/message", { message: "Please book my package" });
  assert.equal(r.status, 200);
  assert.equal(r.body.quote.delivery.unattended, false);
  assert.ok(r.body.quote.price.total > 1);
  assert.equal(db.prepare("SELECT count(*) n FROM bookings").get().n, 0);
  const booked = await c(
    "/bookings",
    { quoteId: r.body.quote.id, accepted: true },
    { "Idempotency-Key": randomUUID() },
  );
  assert.equal(booked.status, 201);
});
test("Corey cannot quote before verification or bypass delivery validation", async (t) => {
  let last;
  const provider = async (input) => {
    if (input.at(-1).role === "user") return aiCall("prepare_quote");
    last = JSON.parse(input.at(-1).output);
    return aiText("Please check your details.");
  };
  const { client, db } = await fixture(t, { aiProvider: provider });
  const c = client();
  await c("/corey/message", {
    message: "Quote this",
    draft: { ...sample, weight: "51" },
  });
  assert.match(last.error, /verify their account/);
  await login(c);
  await c("/corey/message", { message: "Quote now" });
  assert.match(last.error, /at most 50/);
  assert.equal(db.prepare("SELECT count(*) n FROM quotes").get().n, 0);
});
test("Corey history is browser-bound and statuses are scoped to the verified account", async (t) => {
  const histories = [];
  let result;
  const provider = async (input) => {
    histories.push(JSON.stringify(input));
    if (input.at(-1).role === "user") return aiCall("list_my_deliveries");
    result = JSON.parse(input.at(-1).output);
    return aiText("Here is your status.");
  };
  const { client } = await fixture(t, { aiProvider: provider });
  const a = client(),
    b = client();
  await login(a);
  const booked = await book(a);
  await a("/corey/message", { message: "Private conversation marker" });
  assert.equal(result.deliveries.length, 1);
  assert.equal(result.deliveries[0].id, booked.id);
  await login(b, "other@example.com");
  histories.length = 0;
  await b("/corey/message", { message: "My deliveries" });
  assert.equal(result.deliveries.length, 0);
  assert.ok(histories.every((h) => !h.includes("Private conversation marker")));
  await a("/logout", {});
  histories.length = 0;
  await a("/corey/message", { message: "My deliveries again" });
  assert.match(result.error, /Verify your account/);
  assert.ok(histories.every((h) => !h.includes("Private conversation marker")));
});
test("Corey rolls back failed model turns and rejects oversized messages", async (t) => {
  let count = 0,
    failTurn = true;
  const provider = async (input) => {
    if (!failTurn) {
      assert.ok(!JSON.stringify(input).includes("Uncommitted Name"));
      return aiText("Hello");
    }
    if (count++ === 0)
      return aiCall("update_delivery_draft", { name: "Uncommitted Name" });
    throw new Error("Test provider unavailable");
  };
  const { client } = await fixture(t, { aiProvider: provider });
  const c = client();
  assert.equal(
    (await c("/corey/message", { message: "x".repeat(2001) })).status,
    400,
  );
  assert.equal(
    (await c("/corey/message", { message: "Save name" })).status,
    503,
  );
  failTurn = false;
  const r = await c("/corey/message", { message: "Hello" });
  assert.equal(r.status, 200);
  assert.equal(r.body.draft.name, undefined);
});

test("Corey defaults to a local scripted guide even with an API key present", async (t) => {
  const before = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-must-not-be-used";
  try {
    const { client } = await fixture(t);
    const c = client();
    assert.deepEqual((await c("/corey/status")).body, {
      available: true,
      mode: "mock",
    });
    const start = await c("/corey/message", { message: "start" });
    assert.equal(start.status, 200);
    assert.match(start.body.reply, /full name/);
    const name = await c("/corey/message", { message: "Alex Mock" });
    assert.equal(name.body.draft.name, "Alex Mock");
    assert.match(name.body.reply, /email/);
    const invalid = await c("/corey/message", { message: "invalid-email" });
    assert.match(invalid.body.reply, /valid email/);
  } finally {
    if (before === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = before;
  }
});

async function groceryUpload(c, id, overrides = {}, key = randomUUID()) {
  const image =
    "data:image/png;base64," +
    (
      await sharp({
        create: { width: 80, height: 80, channels: 3, background: "#2450d8" },
      })
        .png()
        .toBuffer()
    ).toString("base64");
  return c(
    `/bookings/${id}/readiness`,
    {
      store: "Demo Market",
      orderReference: "DEMO-1042",
      pickupDate: new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
      image,
      ...overrides,
    },
    { "Idempotency-Key": key },
  );
}
const approveEvidence = (id) => ({
  evidenceId: id,
  decision: "approved",
  readyShown: true,
  prepaidShown: true,
  dateMatches: true,
  orderMatches: true,
});
test("grocery evidence is sender-owned, private, and only reviewed by dispatch", async (t) => {
  const { client, db } = await fixture(t);
  const sender = client(),
    other = client(),
    staff = client();
  await login(sender);
  await login(other, "other@example.com");
  const b = await book(sender, { item: "Groceries" });
  assert.equal((await groceryUpload(other, b.id)).status, 404);
  assert.equal(
    (
      await groceryUpload(sender, b.id, {
        image: "data:image/png;base64,bm90YW5pbWFnZQ==",
      })
    ).status,
    400,
  );
  const key = randomUUID(),
    r = await groceryUpload(sender, b.id, {}, key);
  assert.equal(r.status, 201);
  const id = r.body.booking.readiness.id;
  assert.equal((await groceryUpload(sender, b.id, {}, key)).body.reused, true);
  assert.equal(
    db.prepare("SELECT count(*) n FROM grocery_evidence").get().n,
    1,
  );
  assert.equal((await other(`/bookings/${b.id}/readiness/${id}`)).status, 404);
  assert.equal(
    (await sender(`/dispatch/${b.id}/readiness`, approveEvidence(id))).status,
    403,
  );
  await staff("/demo/dispatch-session", {});
  assert.equal(
    (await staff(`/dispatch/${b.id}/assign`, { courierId: "cr-01" })).status,
    409,
  );
  assert.equal(
    (
      await staff(`/dispatch/${b.id}/readiness`, {
        ...approveEvidence(id),
        readyShown: false,
      })
    ).status,
    400,
  );
  assert.equal(
    (await staff(`/dispatch/${b.id}/readiness`, approveEvidence(id))).body
      .booking.status,
    "confirmed",
  );
  assert.equal(
    (await staff(`/dispatch/${b.id}/readiness`, approveEvidence(id))).body
      .reused,
    true,
  );
  assert.equal(
    db
      .prepare("SELECT count(*) n FROM events WHERE kind='readiness_approved'")
      .get().n,
    1,
  );
  assert.equal(
    (await staff(`/dispatch/${b.id}/assign`, { courierId: "cr-01" })).status,
    200,
  );
  assert.equal((await groceryUpload(sender, b.id)).status, 409);
  const tracked = await sender(`/track/${b.trackingToken}`);
  assert.equal(tracked.body.readiness, undefined);
});
test("rejected or replaced grocery evidence cannot dispatch; stale reviewers cannot approve replacements", async (t) => {
  const { client } = await fixture(t);
  const c = client();
  await login(c);
  await c("/demo/dispatch-session", {});
  const b = await book(c, { item: "Groceries" });
  const first = (await groceryUpload(c, b.id)).body.booking.readiness.id;
  const rejected = await c(`/dispatch/${b.id}/readiness`, {
    evidenceId: first,
    decision: "rejected",
    note: "Order is still preparing.",
  });
  assert.equal(rejected.body.booking.status, "awaiting_store_readiness");
  assert.match(rejected.body.booking.readiness.note, /preparing/);
  assert.equal(
    (await c(`/dispatch/${b.id}/readiness`, approveEvidence(first))).status,
    409,
  );
  const second = (await groceryUpload(c, b.id)).body.booking.readiness.id;
  assert.equal(
    (await c(`/dispatch/${b.id}/readiness`, approveEvidence(first))).status,
    409,
  );
  assert.equal(
    (await c(`/dispatch/${b.id}/readiness`, approveEvidence(second))).status,
    200,
  );
  const third = await groceryUpload(c, b.id);
  assert.equal(third.body.booking.status, "awaiting_store_readiness");
  assert.equal(
    (await c(`/dispatch/${b.id}/assign`, { courierId: "cr-01" })).status,
    409,
  );
});
test("grocery approvals require current pickup date and are rechecked at assignment with courier capacity", async (t) => {
  const { client, db } = await fixture(t);
  const c = client();
  await login(c);
  await c("/demo/dispatch-session", {});
  const b = await book(c, { item: "Groceries" });
  const old = (await groceryUpload(c, b.id, { pickupDate: "2020-01-01" })).body
    .booking.readiness.id;
  assert.equal(
    (await c(`/dispatch/${b.id}/readiness`, approveEvidence(old))).status,
    409,
  );
  const id = (await groceryUpload(c, b.id)).body.booking.readiness.id;
  await c(`/dispatch/${b.id}/readiness`, approveEvidence(id));
  const another = await book(c);
  await c(`/dispatch/${another.id}/assign`, { courierId: "cr-01" });
  assert.equal(
    (await c(`/dispatch/${b.id}/assign`, { courierId: "cr-01" })).status,
    409,
  );
  const payload = JSON.parse(
    db.prepare("SELECT payload FROM bookings WHERE id=?").get(b.id).payload,
  );
  payload.readiness.pickupDate = "2020-01-01";
  db.prepare("UPDATE bookings SET payload=? WHERE id=?").run(
    JSON.stringify(payload),
    b.id,
  );
  assert.equal(
    (await c(`/dispatch/${b.id}/assign`, { courierId: "cr-02" })).status,
    409,
  );
  const scheduled = await book(c, {
    item: "Groceries",
    service: "Scheduled",
    date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    window: "10 a.m.–1 p.m.",
  });
  const sid = (await groceryUpload(c, scheduled.id)).body.booking.readiness.id;
  assert.equal(
    (await c(`/dispatch/${scheduled.id}/readiness`, approveEvidence(sid)))
      .status,
    409,
  );
});

test("simulated tracking is courier-scoped, sequenced, persisted and cannot complete a handoff", async (t) => {
  const { client, db } = await fixture(t);
  const sender = client(),
    driver = client(),
    other = client(),
    recipient = client();
  await login(sender);
  const b = await book(sender);
  await sender("/demo/dispatch-session", {});
  await sender(`/dispatch/${b.id}/assign`, { courierId: "cr-01" });
  await driver("/demo/courier-session", { courierId: "cr-01" });
  await other("/demo/courier-session", { courierId: "cr-02" });
  assert.equal(
    (
      await recipient(`/courier/${b.id}/simulation`, {
        action: "advance",
        sequence: 0,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await other(`/courier/${b.id}/simulation`, {
        action: "advance",
        sequence: 0,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await driver(`/courier/${b.id}/simulation`, {
        action: "advance",
        sequence: 0,
      })
    ).status,
    409,
  );
  await driver(`/courier/${b.id}/advance`, { status: "heading_to_pickup" });
  let r = (await recipient("/track/" + b.trackingToken)).body;
  assert.equal(r.tracking.route.to, "Atlanta");
  assert.equal(r.tracking.progress, 0);
  assert.equal(r.location.source, "simulation");
  const initial = r.tracking.sequence;
  const moved = await driver(`/courier/${b.id}/simulation`, {
    action: "advance",
    sequence: initial,
    progress: 100,
    latitude: 90,
  });
  assert.equal(moved.body.tracking.progress, 20);
  assert.equal(
    (
      await driver(`/courier/${b.id}/simulation`, {
        action: "advance",
        sequence: initial,
      })
    ).status,
    409,
  );
  let trip = moved.body.tracking;
  trip = (
    await driver(`/courier/${b.id}/simulation`, {
      action: "pause",
      sequence: trip.sequence,
    })
  ).body.tracking;
  assert.equal(trip.stale, true);
  assert.equal(
    (
      await driver(`/courier/${b.id}/simulation`, {
        action: "advance",
        sequence: trip.sequence,
      })
    ).status,
    409,
  );
  trip = (
    await driver(`/courier/${b.id}/simulation`, {
      action: "resume",
      sequence: trip.sequence,
    })
  ).body.tracking;
  while (trip.progress < 100)
    trip = (
      await driver(`/courier/${b.id}/simulation`, {
        action: "advance",
        sequence: trip.sequence,
      })
    ).body.tracking;
  r = (await recipient("/track/" + b.trackingToken)).body;
  assert.equal(r.status, "heading_to_pickup");
  assert.equal(r.tracking.progress, 100);
  assert.equal(
    JSON.parse(
      db.prepare("SELECT payload FROM bookings WHERE id=?").get(b.id).payload,
    ).simulatedTrip.progress,
    100,
  );
  await driver(`/courier/${b.id}/advance`, { status: "picked_up" });
  await driver(`/courier/${b.id}/advance`, { status: "heading_to_delivery" });
  r = (await recipient("/track/" + b.trackingToken)).body;
  assert.equal(r.tracking.phase, "delivery");
  assert.equal(r.tracking.progress, 0);
  assert.equal(r.tracking.route.to, "Decatur");
  const stored = JSON.parse(
    db.prepare("SELECT payload FROM bookings WHERE id=?").get(b.id).payload,
  );
  stored.simulatedTrip.updatedAt = new Date(Date.now() - 120000).toISOString();
  db.prepare("UPDATE bookings SET payload=? WHERE id=?").run(
    JSON.stringify(stored),
    b.id,
  );
  assert.equal(
    (await recipient("/track/" + b.trackingToken)).body.tracking.stale,
    true,
  );
  await driver(`/courier/${b.id}/advance`, { status: "handoff_failed" });
  await driver(`/courier/${b.id}/advance`, { status: "returning" });
  r = (await recipient("/track/" + b.trackingToken)).body;
  assert.equal(r.tracking.phase, "return");
  assert.equal(r.tracking.route.to, "Atlanta");
  assert.equal(r.tracking.progress, 0);
  assert.equal(JSON.stringify(r).includes(sample.pickup), false);
});

async function cancelPreview(c, b) {
  return c(`/bookings/${b.id}/cancellation-quote`, {});
}
async function cancelConfirm(c, b, q, key = randomUUID()) {
  return c(
    `/bookings/${b.id}/cancel`,
    { quoteId: q.id, accepted: true },
    { "Idempotency-Key": key },
  );
}
test("pre-pickup cancellation is scoped, explicit and releases authorization exactly once", async (t) => {
  const { client, db } = await fixture(t);
  const c = client(),
    other = client();
  await login(c);
  await login(other, "other@example.com");
  const b = await book(c);
  assert.equal((await cancelPreview(other, b)).status, 404);
  const q = (await cancelPreview(c, b)).body;
  assert.equal(q.fee, 0);
  assert.equal(
    (
      await c(
        `/bookings/${b.id}/cancel`,
        { quoteId: q.id },
        { "Idempotency-Key": "cancel" },
      )
    ).status,
    400,
  );
  const r = await cancelConfirm(c, b, q, "cancel");
  assert.equal(r.body.booking.status, "cancelled");
  assert.equal(r.body.booking.paymentStatus, "authorization_released");
  assert.equal((await cancelConfirm(c, b, q, "cancel")).body.reused, true);
  assert.equal(
    db
      .prepare(
        "SELECT count(*) n FROM payments WHERE kind='authorization_release'",
      )
      .get().n,
    1,
  );
  assert.equal(
    db
      .prepare("SELECT amount FROM payments WHERE kind='authorization_release'")
      .get().amount,
    b.price.total,
  );
  assert.equal((await c("/track/" + b.trackingToken)).body.location, null);
});
test("two-mile cancellation captures only base and rejects stale or changed location previews", async (t) => {
  const { client, db } = await fixture(t);
  const c = client();
  await login(c);
  await c("/demo/dispatch-session", {});
  await c("/demo/courier-session", { courierId: "cr-01" });
  const b = await book(c, { service: "Expedited" });
  await c(`/dispatch/${b.id}/assign`, { courierId: "cr-01" });
  await c(`/courier/${b.id}/advance`, { status: "heading_to_pickup" });
  let q = (await cancelPreview(c, b)).body;
  assert.equal(q.fee, 0);
  let trip = (await c(`/bookings/${b.id}`)).body.booking.tracking;
  for (let i = 0; i < 3; i++)
    trip = (
      await c(`/courier/${b.id}/simulation`, {
        action: "advance",
        sequence: trip.sequence,
      })
    ).body.tracking;
  assert.equal(trip.pickupMilesRemaining, 2);
  assert.equal((await cancelConfirm(c, b, q)).status, 409);
  q = (await cancelPreview(c, b)).body;
  assert.equal(q.fee, b.price.base);
  assert.equal(q.released, b.price.total - b.price.base);
  trip = (
    await c(`/courier/${b.id}/simulation`, {
      action: "pause",
      sequence: trip.sequence,
    })
  ).body.tracking;
  assert.equal((await cancelPreview(c, b)).status, 409);
  assert.equal((await cancelConfirm(c, b, q)).status, 409);
  await c(`/courier/${b.id}/simulation`, {
    action: "resume",
    sequence: trip.sequence,
  });
  q = (await cancelPreview(c, b)).body;
  const r = await cancelConfirm(c, b, q);
  assert.equal(r.body.booking.status, "cancelled");
  assert.equal(
    db
      .prepare("SELECT amount FROM payments WHERE kind='cancellation_fee'")
      .get().amount,
    b.price.base,
  );
  const next = await book(c);
  assert.equal(
    (await c(`/dispatch/${next.id}/assign`, { courierId: "cr-01" })).status,
    200,
  );
});
test("after-pickup cancellation preserves custody and charges only after signed return", async (t) => {
  const { sender, courier, b, db } = await prepared(t, { unattended: true });
  const q = (await cancelPreview(sender, b)).body;
  assert.equal(q.action, "return");
  assert.equal(q.fee, b.price.returnTotal);
  const r = await cancelConfirm(sender, b, q);
  assert.equal(r.body.booking.status, "return_scheduled");
  assert.equal(r.body.booking.returnOnly, true);
  assert.equal(
    db
      .prepare("SELECT count(*) n FROM payments WHERE kind='return_charge'")
      .get().n,
    0,
  );
  assert.equal(
    (await sender(`/bookings/${b.id}/unattended`, { authorize: true })).status,
    409,
  );
  assert.equal(
    (
      await courier(
        `/courier/${b.id}/complete`,
        {
          leg: "delivery",
          method: "photo",
          photo: await image(),
          safeLocation: true,
        },
        { "Idempotency-Key": "wrong-after-cancel" },
      )
    ).status,
    409,
  );
  await courier(`/courier/${b.id}/advance`, { status: "returning" });
  const body = { leg: "return", method: "signature", ...signature },
    headers = { "Idempotency-Key": "signed-cancel-return" };
  assert.equal(
    (await courier(`/courier/${b.id}/complete`, body, headers)).body.booking
      .status,
    "returned",
  );
  await courier(`/courier/${b.id}/complete`, body, headers);
  assert.equal(
    db.prepare("SELECT amount FROM payments WHERE kind='return_charge'").get()
      .amount,
    b.price.returnTotal,
  );
});
test("company failure cancels before pickup without fee and requires staff confirmation", async (t) => {
  const { client, db } = await fixture(t);
  const c = client();
  await login(c);
  const b = await book(c);
  const path = `/dispatch/${b.id}/company-failure`,
    body = { reason: "Vehicle unavailable", confirmed: true },
    headers = { "Idempotency-Key": "company-cancel" };
  assert.equal((await c(path, body, headers)).status, 403);
  await c("/demo/dispatch-session", {});
  assert.equal(
    (await c(path, { ...body, confirmed: false }, headers)).status,
    400,
  );
  const r = await c(path, body, headers);
  assert.equal(r.body.booking.status, "cancelled");
  assert.equal((await c(path, body, headers)).body.reused, true);
  assert.equal(
    db
      .prepare("SELECT amount FROM payments WHERE kind='authorization_release'")
      .get().amount,
    b.price.total,
  );
  assert.equal(
    db
      .prepare("SELECT count(*) n FROM payments WHERE kind='cancellation_fee'")
      .get().n,
    0,
  );
});
test("company failure holds assignment until recovery and waives return fee without inventing a refund", async (t) => {
  const { sender, courier, b, db } = await prepared(t);
  const path = `/dispatch/${b.id}/company-failure`;
  const r = await sender(
    path,
    { reason: "Vehicle issue after pickup", confirmed: true, canReturn: false },
    { "Idempotency-Key": "hold" },
  );
  assert.equal(r.body.booking.status, "exception_hold");
  assert.equal(r.body.booking.exception.refundStatus, "review_required");
  const next = await book(sender);
  assert.equal(
    (await sender(`/dispatch/${next.id}/assign`, { courierId: "cr-01" }))
      .status,
    409,
  );
  assert.equal(
    (await sender(`/dispatch/${b.id}/resolve-return`, { canReturn: true }))
      .status,
    400,
  );
  assert.equal(
    (
      await sender(`/dispatch/${b.id}/resolve-return`, {
        canReturn: true,
        packageWithCourier: true,
      })
    ).body.booking.status,
    "return_scheduled",
  );
  await courier(`/courier/${b.id}/advance`, { status: "returning" });
  const done = await courier(
    `/courier/${b.id}/complete`,
    { leg: "return", method: "signature", ...signature },
    { "Idempotency-Key": "no-fee-return" },
  );
  assert.equal(done.body.booking.status, "returned");
  assert.equal(
    db
      .prepare("SELECT amount FROM payments WHERE kind='return_fee_waived'")
      .get().amount,
    0,
  );
  assert.equal(
    db
      .prepare(
        "SELECT count(*) n FROM payments WHERE kind IN ('return_charge','refund')",
      )
      .get().n,
    0,
  );
});

test("scheduled confirmations reserve capacity atomically and cancellation releases it", async (t) => {
  const { client, db } = await fixture(t);
  const c = client();
  await login(c);
  const d = {
    ...sample,
    service: "Scheduled",
    date: "2099-06-02",
    window: "10 a.m.–1 p.m.",
  };
  const quotes = [];
  for (let i = 0; i < 4; i++) quotes.push((await c("/quotes", d)).body);
  assert.equal(
    (await c("/availability?date=2099-06-02")).body.windows[1].available,
    3,
  );
  const results = await Promise.all(
    quotes.map((q) =>
      c(
        "/bookings",
        { quoteId: q.id, accepted: true },
        { "Idempotency-Key": randomUUID() },
      ),
    ),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 3);
  assert.equal(results.filter((r) => r.status === 409).length, 1);
  const reserved = results
    .filter((r) => r.status === 201)
    .map((r) => r.body.booking);
  assert.equal(new Set(reserved.map((b) => b.schedule.courierId)).size, 3);
  assert.equal(
    (await c("/availability?date=2099-06-02")).body.windows[1].available,
    0,
  );
  const q = (await cancelPreview(c, reserved[0])).body;
  await cancelConfirm(c, reserved[0], q);
  assert.equal(
    (await c("/availability?date=2099-06-02")).body.windows[1].available,
    1,
  );
  assert.equal(
    db
      .prepare("SELECT count(*) n FROM payments WHERE kind='authorization'")
      .get().n,
    3,
  );
});
test("shift changes require staff and preserve booked delivery and return windows", async (t) => {
  const { client } = await fixture(t);
  const c = client();
  await login(c);
  const b = await book(c, {
    service: "Scheduled",
    date: "2099-06-03",
    window: "1–4 p.m.",
  });
  const path = `/dispatch/shifts/${b.schedule.courierId}`,
    body = { date: "2099-06-03", onDuty: false, startHour: 8, endHour: 20 };
  assert.equal((await c(path, body)).status, 403);
  await c("/demo/dispatch-session", {});
  assert.equal((await c(path, body)).status, 409);
  assert.equal(
    (await c(path, { ...body, onDuty: true, endHour: 15 })).status,
    409,
  );
  assert.equal((await c("/dispatch/shifts/cr-02", body)).status, 200);
  assert.equal(
    (await c("/availability?date=2099-06-03")).body.windows[2].available,
    1,
  );
  const publicView = (await c("/availability?date=2099-06-03")).body;
  assert.equal(publicView.couriers, undefined);
});
test("schedule enforces route fit, date boundaries and protects planned slots from same-day assignment", async (t) => {
  let clock = new Date("2099-06-01T16:00:00Z");
  const { client } = await fixture(t, { scheduleNow: () => clock });
  const c = client();
  await login(c);
  await c("/demo/dispatch-session", {});
  await c("/demo/courier-session", { courierId: "cr-01" });
  assert.equal(
    (
      await c("/quotes", {
        ...sample,
        service: "Scheduled",
        date: "2099-06-01",
        window: "8–10 a.m.",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await c("/quotes", {
        ...sample,
        service: "Scheduled",
        date: "2099-06-02",
        window: "8–10 a.m.",
        dropoff: "100 Sample Road, Peachtree City 30269",
      })
    ).status,
    409,
  );
  const b = await book(c, {
    service: "Scheduled",
    date: "2099-06-02",
    window: "1–4 p.m.",
  });
  assert.equal(
    (await c(`/dispatch/${b.id}/assign`, { courierId: "cr-01" })).status,
    409,
  );
  clock = new Date("2099-06-02T16:00:00Z");
  const immediate = await book(c);
  assert.equal(
    (await c(`/dispatch/${immediate.id}/assign`, { courierId: "cr-01" }))
      .status,
    409,
  );
  assert.equal(
    (await c(`/dispatch/${b.id}/assign`, { courierId: "cr-01" })).status,
    200,
  );
  assert.equal(
    (await c(`/courier/${b.id}/advance`, { status: "heading_to_pickup" }))
      .status,
    409,
  );
  clock = new Date("2099-06-02T17:05:00Z");
  assert.equal(
    (await c(`/courier/${b.id}/advance`, { status: "heading_to_pickup" }))
      .status,
    200,
  );
});
