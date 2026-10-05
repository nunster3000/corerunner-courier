import { ACCOUNT_TTL_MS } from "./account-retention.js";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export function localPortfolioStore(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY,snapshot TEXT,revision INTEGER DEFAULT 0,expires INTEGER);
    CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,email TEXT UNIQUE,password TEXT,profile TEXT,role TEXT,snapshot TEXT,revision INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS account_sessions(token TEXT PRIMARY KEY,account_id TEXT REFERENCES accounts(id),expires INTEGER);
    CREATE TABLE IF NOT EXISTS limits(id TEXT PRIMARY KEY,bucket INTEGER,count INTEGER);`);
  const columns = db
    .prepare("PRAGMA table_info(accounts)")
    .all()
    .map((c) => c.name);
  if (!columns.includes("email_verified"))
    db.exec(
      "ALTER TABLE accounts ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0",
    );
  if (!columns.includes("verification"))
    db.exec("ALTER TABLE accounts ADD COLUMN verification TEXT");
  if (!columns.includes("expires_at")) {
    db.exec("ALTER TABLE accounts ADD COLUMN expires_at TEXT");
    db.prepare("UPDATE accounts SET expires_at=? WHERE expires_at IS NULL").run(
      new Date(Date.now() + ACCOUNT_TTL_MS).toISOString(),
    );
  }
  const decode = (row) =>
    row
      ? {
          ...row,
          email_verified: !!row.email_verified,
          verification: row.verification ? JSON.parse(row.verification) : null,
          ...(row.snapshot ? { snapshot: JSON.parse(row.snapshot) } : {}),
          ...(row.profile ? { profile: JSON.parse(row.profile) } : {}),
        }
      : null;
  return {
    close: () => db.close(),
    initialize: async () => {},
    async read(id) {
      return decode(
        db
          .prepare("SELECT * FROM workspaces WHERE id=? AND expires>?")
          .get(id, Date.now()),
      );
    },
    async create(id, snapshot, expires) {
      db.prepare("DELETE FROM workspaces WHERE expires<=?").run(Date.now());
      db.prepare(
        "INSERT INTO workspaces(id,snapshot,expires) VALUES(?,?,?)",
      ).run(id, JSON.stringify(snapshot), expires);
    },
    async save(id, revision, snapshot) {
      return (
        db
          .prepare(
            "UPDATE workspaces SET snapshot=?,revision=revision+1 WHERE id=? AND revision=?",
          )
          .run(JSON.stringify(snapshot), id, revision).changes === 1
      );
    },
    async allow(id, max, window, now) {
      const bucket = Math.floor(now / window);
      db.prepare(
        "INSERT INTO limits VALUES(?,?,1) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN bucket=excluded.bucket THEN count+1 ELSE 1 END,bucket=excluded.bucket",
      ).run(id, bucket);
      return (
        db.prepare("SELECT count FROM limits WHERE id=?").get(id).count <= max
      );
    },
    async cleanupAccounts(now = Date.now()) {
      db.exec("BEGIN");
      try {
        const stamp = new Date(now).toISOString();
        db.prepare(
          "DELETE FROM account_sessions WHERE account_id IN (SELECT id FROM accounts WHERE expires_at<=?) OR expires<=?",
        ).run(stamp, now);
        db.prepare("DELETE FROM accounts WHERE expires_at<=?").run(stamp);
        db.prepare("DELETE FROM workspaces WHERE expires<=?").run(now);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    async findAccount(email) {
      return decode(
        db
          .prepare(
            "SELECT id,email,password,profile,role,email_verified,expires_at FROM accounts WHERE email=? AND expires_at>?",
          )
          .get(email, new Date().toISOString()),
      );
    },
    async setVerification(id, verification) {
      db.prepare(
        "UPDATE accounts SET verification=? WHERE id=? AND email_verified=0",
      ).run(JSON.stringify(verification), id);
    },
    async verifyAccount(id, session, token, now) {
      return (
        db
          .prepare(
            "UPDATE accounts SET email_verified=1,verification=NULL WHERE id=? AND email_verified=0 AND json_extract(verification,'$.session')=? AND json_extract(verification,'$.token')=? AND json_extract(verification,'$.expires')>?",
          )
          .run(id, session, token, now).changes === 1
      );
    },
    async createAccount(a) {
      return (
        db
          .prepare(
            "INSERT INTO accounts(id,email,password,profile,role,snapshot,expires_at) VALUES(?,?,?,?,'customer',?,?) ON CONFLICT(email) DO NOTHING",
          )
          .run(
            a.id,
            a.email,
            a.password,
            JSON.stringify(a.profile),
            JSON.stringify(a.snapshot),
            a.expires_at,
          ).changes === 1
      );
    },
    async createAccountSession(token, id, expires) {
      db.prepare("INSERT INTO account_sessions VALUES(?,?,?)").run(
        token,
        id,
        expires,
      );
    },
    async deleteAccountSession(token) {
      db.prepare("DELETE FROM account_sessions WHERE token=?").run(token);
    },
    async readAccountSession(token) {
      return decode(
        db
          .prepare(
            "SELECT a.* FROM accounts a JOIN account_sessions s ON s.account_id=a.id WHERE s.token=? AND s.expires>? AND a.expires_at>?",
          )
          .get(token, Date.now(), new Date().toISOString()),
      );
    },
    async saveAccount(id, revision, snapshot) {
      return (
        db
          .prepare(
            "UPDATE accounts SET snapshot=?,revision=revision+1 WHERE id=? AND revision=?",
          )
          .run(JSON.stringify(snapshot), id, revision).changes === 1
      );
    },
  };
}
