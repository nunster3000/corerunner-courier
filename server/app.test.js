import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createApp } from "./app.js";
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
  const { app, db } = createApp({ dbPath: ":memory:", ...options });
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
    400,
  );
  const returned = await c(`/dispatch/${b.id}/advance`, {
    status: "returned",
    receivedBy: "Alex",
  });
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
