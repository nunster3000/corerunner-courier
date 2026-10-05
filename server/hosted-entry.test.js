import test from "node:test";
import assert from "node:assert/strict";
import { configurationIssues, createHostedHandler } from "./hosted-entry.js";

const env = {
  APP_MODE: "portfolio",
  DATABASE_URL: "private-database-credential",
  DEMO_ACCESS_PASSWORD: "private-password-for-demo",
  DEMO_SESSION_SECRET: "private-signing-secret-with-enough-characters",
  APP_ORIGIN: "https://demo.example",
};
const response = () => ({
  statusCode: 200,
  headers: {},
  setHeader(k, v) {
    this.headers[k] = v;
  },
  end(body) {
    this.body = body;
  },
});

test("hosted startup identifies missing settings without leaking credentials or connecting", async () => {
  assert.deepEqual(configurationIssues(env), []);
  assert.deepEqual(configurationIssues({}), [
    "APP_MODE",
    "DATABASE_URL",
    "DEMO_ACCESS_PASSWORD",
    "DEMO_SESSION_SECRET",
    "APP_ORIGIN",
  ]);
  const logs = [];
  const handle = createHostedHandler({
    env: { ...env, APP_MODE: "" },
    log: (value) => logs.push(value),
    makeStore: () => {
      throw new Error("Must not connect");
    },
  });
  const res = response();
  await handle({}, res);
  assert.equal(res.statusCode, 503);
  assert.match(res.body, /DEPLOYMENT_SETUP_REQUIRED/);
  assert.match(logs[0], /APP_MODE/);
  assert.doesNotMatch(logs.join("") + res.body, /private-/);
});

test("cold requests share initialization and never serve before the schema is ready", async () => {
  let initializeCalls = 0,
    appCalls = 0,
    finish;
  const gate = new Promise((resolve) => {
    finish = resolve;
  });
  const handle = createHostedHandler({
    env,
    makeStore: () => ({
      async initialize() {
        initializeCalls++;
        await gate;
      },
    }),
    makeApp: () => (req, res) => {
      appCalls++;
      res.end("ready");
    },
  });
  const a = response(),
    b = response();
  const first = handle({}, a),
    second = handle({}, b);
  assert.equal(initializeCalls, 1);
  assert.equal(appCalls, 0);
  finish();
  await Promise.all([first, second]);
  assert.equal(a.body, "ready");
  assert.equal(b.body, "ready");
  assert.equal(appCalls, 2);
});

test("failed schema initialization is redacted and retried on a later request", async () => {
  let calls = 0;
  const logs = [];
  const handle = createHostedHandler({
    env,
    log: (value) => logs.push(value),
    makeStore: () => ({
      async initialize() {
        if (++calls === 1) throw new Error(env.DATABASE_URL);
      },
    }),
    makeApp: () => (req, res) => res.end("ready"),
  });
  const first = response();
  await handle({}, first);
  assert.equal(first.statusCode, 503);
  assert.match(first.body, /DEPLOYMENT_STORAGE_UNAVAILABLE/);
  assert.doesNotMatch(first.body + logs.join(""), /private-/);
  const second = response();
  await handle({}, second);
  assert.equal(second.body, "ready");
  assert.equal(calls, 2);
});
