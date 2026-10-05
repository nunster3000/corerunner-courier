import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHostedDemo } from "./hosted-demo.js";
import { localPortfolioStore } from "./local-portfolio-store.js";
const profile = {
  name: "Persistent Sample",
  email: "saved@example.com",
  phone: "4045550123",
  pickup: "100 Sample Street, Atlanta",
  password: "Only-a-test-password-73!",
};
async function fixture(path) {
  const store = localPortfolioStore(path);
  const app = createHostedDemo({
    store,
    origin: "http://127.0.0.1",
    secure: false,
    secret: "testing-only-account-session-secret",
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const browser = () => {
    const jar = new Map();
    return {
      jar,
      async call(path, body, headers = {}) {
        const r = await fetch(base + path, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
            "content-type": "application/json",
            ...headers,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        for (const c of r.headers.getSetCookie()) {
          const pair = c.split(";")[0],
            i = pair.indexOf("=");
          jar.set(pair.slice(0, i), pair.slice(i + 1));
        }
        return { status: r.status, body: await r.json() };
      },
    };
  };
  return {
    store,
    browser,
    close: async () => {
      await new Promise((r) => server.close(r));
      store.close();
    },
  };
}
test("password account and booking survive server restart, new browser login and guest expiration", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cr-accounts-")),
    path = join(dir, "accounts.sqlite");
  let f = await fixture(path);
  try {
    const a = f.browser();
    assert.equal(
      (await a.call("/auth/register", { ...profile, password: "short" }))
        .status,
      400,
    );
    const created = await a.call("/auth/register", {
      ...profile,
      role: "admin",
    });
    assert.equal(created.status, 200);
    assert.equal(created.body.user.role, "customer");
    const id = created.body.user.id;
    const stored = await f.store.findAccount(profile.email);
    assert.notEqual(stored.password, profile.password);
    assert.match(stored.password, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
    assert.equal((await a.call("/me")).body.user.persistent, true);
    const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const quote = await a.call("/quotes", {
      ...profile,
      dropoff: "200 Test Lane, Smyrna",
      recipient: "Demo Receiver",
      recipientEmail: "receiver@example.com",
      item: "Everyday package",
      weight: 5,
      service: "Scheduled",
      date,
      window: "10 a.m.–1 p.m.",
    });
    assert.equal(quote.status, 201);
    const booking = await a.call(
      "/bookings",
      { quoteId: quote.body.id, accepted: true },
      { "Idempotency-Key": "saved-account-booking" },
    );
    assert.equal(booking.status, 201);
    const accountToken = a.jar.get("cr_account");
    const s = await f.store.readAccountSession(
      (await import("./accounts.js")).accountTokenHash(accountToken),
    );
    assert.equal(s.snapshot.tables.quotes.length, 1);
    assert.equal((await a.call("/auth/request", profile)).status, 410);
    assert.equal((await a.call("/demo/dispatch-session", {})).status, 403);
    assert.equal((await a.call("/auth/signout", {})).status, 200);
    await f.close();
    f = await fixture(path);
    const b = f.browser();
    assert.equal(
      (await b.call("/auth/login", { email: profile.email, password: "wrong" }))
        .status,
      401,
    );
    assert.equal(
      (await b.call("/auth/register", { ...profile, name: "Overwrite" }))
        .status,
      409,
    );
    const login = await b.call("/auth/login", {
      email: "SAVED@example.com",
      password: profile.password,
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.id, id);
    assert.equal(login.body.user.name, profile.name);
    const me = await b.call("/me");
    assert.equal(me.body.user.id, id);
    const row = await f.store.readAccountSession(
      (await import("./accounts.js")).accountTokenHash(b.jar.get("cr_account")),
    );
    assert.equal(row.snapshot.tables.quotes[0].id, quote.body.id);
    const other = f.browser();
    await other.call("/auth/register", {
      ...profile,
      email: "other@example.com",
    });
    assert.equal(
      (await b.call("/bookings")).body.bookings[0].id,
      booking.body.booking.id,
    );
    assert.equal((await other.call("/bookings")).body.bookings.length, 0);
    assert.equal(
      (await other.call("/bookings/" + booking.body.booking.id)).status,
      404,
    );
    assert.equal((await other.call("/dispatch")).status, 403);
  } finally {
    await f.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
