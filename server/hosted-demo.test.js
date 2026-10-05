import test from "node:test";
import assert from "node:assert/strict";
import { createHostedDemo } from "./hosted-demo.js";
import { createApp } from "./app.js";
import { captureDemo, restoreDemo } from "./demo-snapshot.js";

const password = "sample-reviewer-password";
const secret = "sample-signing-secret-for-isolated-tests";
function memoryStore() {
  const rows = new Map(),
    limits = new Map();
  return {
    rows,
    failSave: false,
    conflict: false,
    async read(id) {
      return structuredClone(rows.get(id) || null);
    },
    async create(id, snapshot, expires) {
      rows.set(id, {
        snapshot: structuredClone(snapshot),
        revision: 0,
        expires,
      });
    },
    async save(id, revision, snapshot) {
      if (this.failSave)
        throw new Error(
          "Simulated storage outage with sensitive connection detail",
        );
      const row = rows.get(id);
      if (this.conflict || row.revision !== revision) return false;
      rows.set(id, {
        ...row,
        revision: revision + 1,
        snapshot: structuredClone(snapshot),
      });
      return true;
    },
    async allow(key, max, window, now) {
      const bucket = `${key}:${Math.floor(now / window)}`;
      const n = (limits.get(bucket) || 0) + 1;
      limits.set(bucket, n);
      return n <= max;
    },
  };
}
async function fixture(t, options = {}) {
  const store = options.store || memoryStore();
  const app = createHostedDemo({
    store,
    password,
    secret,
    origin: "http://127.0.0.1",
    secure: false,
    ...options,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = () => {
    const jar = new Map();
    return {
      jar,
      async call(path, body, extra = {}) {
        const response = await fetch(url + "/api" + path, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
            ...(body === undefined
              ? {}
              : { "Content-Type": "application/json" }),
            ...extra,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        for (const line of response.headers.getSetCookie()) {
          const pair = line.split(";")[0];
          const at = pair.indexOf("=");
          jar.set(pair.slice(0, at), pair.slice(at + 1));
        }
        return {
          status: response.status,
          body: await response.json(),
          headers: response.headers,
        };
      },
    };
  };
  return { store, browser };
}
async function unlock(b) {
  assert.equal((await b.call("/demo-access", { password })).status, 200);
  assert.equal((await b.call("/operator")).status, 200);
}
async function signup(b) {
  assert.equal(
    (
      await b.call("/auth/request", {
        name: "Sample Person",
        email: "sample@example.com",
        phone: "4045550123",
        pickup: "100 Sample Street, Atlanta",
      })
    ).status,
    200,
  );
  const inbox = await b.call("/auth/inbox");
  const result = await b.call("/auth/verify", { token: inbox.body.token });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body.user;
}

test("hosted demo gates access and persists independent browser workspaces across fresh app instances", async (t) => {
  const { store, browser } = await fixture(t);
  const a = browser(),
    b = browser();
  assert.equal((await a.call("/operator")).status, 401);
  assert.equal(
    (await a.call("/demo-access", { password: "wrong" })).status,
    401,
  );
  assert.equal(
    (
      await a.call(
        "/demo-access",
        { password },
        { origin: "https://evil.example" },
      )
    ).status,
    403,
  );
  await unlock(a);
  await unlock(b);
  const userA = await signup(a),
    userB = await signup(b);
  assert.notEqual(userA.id, userB.id);
  const run = await a.call("/demo/scenarios/everyday", { accepted: true });
  assert.equal(run.status, 201, JSON.stringify(run.body));
  assert.equal((await b.call("/bookings")).body.bookings.length, 0);
  assert.equal((await b.call("/demo/dispatch-session", {})).status, 200);
  assert.equal((await b.call("/dispatch")).body.bookings.length, 0);
  await a.call("/corey/message", { message: "start" });
  const answer = await a.call("/corey/message", {
    message: "100 Sample Street, Atlanta",
  });
  assert.equal(answer.body.draft.pickup, "100 Sample Street, Atlanta");
  const cold = await fixture(t, { store });
  const resumed = cold.browser();
  for (const pair of a.jar) resumed.jar.set(...pair);
  assert.equal((await resumed.call("/bookings")).body.bookings.length, 1);
  const next = await resumed.call("/corey/message", {
    message: "200 Example Lane, Decatur",
  });
  assert.equal(next.body.draft.pickup, "100 Sample Street, Atlanta");
  assert.equal(next.body.draft.dropoff, "200 Example Lane, Decatur");
  assert.equal(store.rows.size, 2);
});

test("failed persistence and revision conflicts never confirm success or overwrite saved state", async (t) => {
  const { store, browser } = await fixture(t);
  const b = browser();
  await unlock(b);
  await signup(b);
  store.failSave = true;
  let result = await b.call("/demo/scenarios/everyday", { accepted: true });
  assert.equal(result.status, 503);
  assert.doesNotMatch(
    JSON.stringify(result.body),
    /sensitive|connection detail/,
  );
  assert.equal(result.headers.get("set-cookie"), null);
  store.failSave = false;
  store.conflict = true;
  result = await b.call("/demo/scenarios/everyday", { accepted: true });
  assert.equal(result.status, 409);
  store.conflict = false;
  assert.equal((await b.call("/bookings")).body.bookings.length, 0);
  assert.equal(
    (await b.call("/demo/scenarios/everyday", { accepted: true })).status,
    201,
  );
  assert.equal((await b.call("/bookings")).body.bookings.length, 1);
});

test("access expires, forged cookies fail and access attempts are limited", async (t) => {
  let time = Date.now();
  const { browser } = await fixture(t, { now: () => time });
  const b = browser();
  await unlock(b);
  const access = b.jar.get("cr_demo_access");
  b.jar.set(
    "cr_demo_access",
    access.replace(/.$/, access.endsWith("a") ? "b" : "a"),
  );
  assert.equal((await b.call("/operator")).status, 401);
  b.jar.set("cr_demo_access", access);
  time += 2 * 60 * 60 * 1000 + 1;
  assert.equal((await b.call("/operator")).status, 401);
  for (let i = 0; i < 10; i++)
    assert.equal(
      (await b.call("/demo-access", { password: "wrong" })).status,
      401,
    );
  assert.equal((await b.call("/demo-access", { password })).status, 429);
});

test("snapshot preserves binary evidence and rejects unsupported formats", () => {
  const { db } = createApp({ dbPath: ":memory:" });
  const chat = {
    sessions: new Map([["sample", { draft: { pickup: "Atlanta" } }]]),
    requestTimes: [123],
  };
  try {
    // Binary roundtrip on an existing BLOB-capable table, with foreign keys respected.
    db.prepare("INSERT INTO users VALUES(?,?,?)").run(
      "u",
      "u@example.com",
      "{}",
    );
    db.prepare("INSERT INTO quotes VALUES(?,?,?,?)").run("q", "u", "{}", 123);
    db.prepare("INSERT INTO bookings VALUES(?,?,?,?,?)").run(
      "b",
      "u",
      "q",
      "r",
      "{}",
    );
    db.prepare("INSERT INTO grocery_evidence VALUES(?,?,?,?,?)").run(
      "e",
      "b",
      "r",
      "{}",
      Buffer.from([0, 255, 1, 2]),
    );
    const saved = JSON.parse(JSON.stringify(captureDemo(db, chat)));
    restoreDemo(db, chat, saved);
    assert.deepEqual(
      Buffer.from(db.prepare("SELECT image FROM grocery_evidence").get().image),
      Buffer.from([0, 255, 1, 2]),
    );
    assert.equal(chat.sessions.get("sample").draft.pickup, "Atlanta");
    assert.throws(() => restoreDemo(db, chat, { version: 99 }), /Unsupported/);
  } finally {
    db.close();
  }
});

test("secure cookies, missing workspace recovery and workspace capacity are enforced", async (t) => {
  const { store, browser } = await fixture(t, {
    secure: true,
    origin: "https://demo.example",
  });
  const b = browser();
  const access = await b.call("/demo-access", { password });
  assert.match(access.headers.get("set-cookie"), /HttpOnly/);
  assert.match(access.headers.get("set-cookie"), /Secure/);
  assert.match(access.headers.get("set-cookie"), /SameSite=Strict/);
  const boot = await b.call("/operator");
  assert.equal(boot.body.hostedDemo, true);
  assert.match(boot.headers.get("set-cookie"), /Secure/);
  await signup(b);
  store.rows.clear();
  assert.equal(
    (await b.call("/demo/scenarios/everyday", { accepted: true })).status,
    410,
  );
  assert.equal((await b.call("/operator")).status, 200);
  assert.equal((await b.call("/me")).status, 401);
  const tiny = await fixture(t, { snapshotLimit: 100 });
  const full = tiny.browser();
  await full.call("/demo-access", { password });
  const result = await full.call("/operator");
  assert.equal(result.status, 413);
  assert.equal(result.headers.get("set-cookie"), null);
});
