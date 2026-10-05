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
  const decode = (row) =>
    row
      ? {
          ...row,
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
    async findAccount(email) {
      return decode(
        db
          .prepare(
            "SELECT id,email,password,profile,role FROM accounts WHERE email=?",
          )
          .get(email),
      );
    },
    async createAccount(a) {
      return (
        db
          .prepare(
            "INSERT INTO accounts(id,email,password,profile,role,snapshot) VALUES(?,?,?,?,'customer',?) ON CONFLICT(email) DO NOTHING",
          )
          .run(
            a.id,
            a.email,
            a.password,
            JSON.stringify(a.profile),
            JSON.stringify(a.snapshot),
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
            "SELECT a.* FROM accounts a JOIN account_sessions s ON s.account_id=a.id WHERE s.token=? AND s.expires>?",
          )
          .get(token, Date.now()),
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
