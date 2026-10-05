import { randomBytes, scrypt as derive, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { fail } from "./domain.js";
const scrypt = promisify(derive);
export async function passwordHash(password) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  )
    fail(400, "Choose a password between 12 and 128 characters.");
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}
export async function passwordMatches(password, stored) {
  if (typeof password !== "string" || password.length > 128) return false;
  const [salt, hex] = (
    stored || "00000000000000000000000000000000:" + "00".repeat(64)
  ).split(":");
  const key = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}
