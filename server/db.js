import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export function openDatabase(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;");
  db.exec(`
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,profile TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY,token TEXT NOT NULL,profile TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS staff_sessions(token TEXT PRIMARY KEY,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS quotes(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),payload TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),quote_id TEXT UNIQUE NOT NULL REFERENCES quotes(id),request_key TEXT NOT NULL,payload TEXT NOT NULL,UNIQUE(user_id,request_key));
 CREATE TABLE IF NOT EXISTS couriers(id TEXT PRIMARY KEY,name TEXT NOT NULL,vehicle TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,booking_id TEXT NOT NULL REFERENCES bookings(id),actor TEXT NOT NULL,kind TEXT NOT NULL,created TEXT NOT NULL,detail TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY AUTOINCREMENT,booking_id TEXT NOT NULL REFERENCES bookings(id),kind TEXT NOT NULL,amount INTEGER NOT NULL,created TEXT NOT NULL,UNIQUE(booking_id,kind));
 CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL REFERENCES users(id),recipient TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS tracking(token TEXT PRIMARY KEY,booking_id TEXT UNIQUE NOT NULL REFERENCES bookings(id),expires INTEGER NOT NULL);
 `);
  const seed = db.prepare("INSERT OR IGNORE INTO couriers VALUES(?,?,?)");
  for (const c of [
    ["cr-01", "Jordan Ellis", "SUV"],
    ["cr-02", "Morgan Reed", "Sedan"],
    ["cr-03", "Taylor Brooks", "SUV"],
  ])
    seed.run(...c);
  return db;
}
export function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    db.exec("COMMIT");
    return value;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
