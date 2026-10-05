import test from "node:test";
import assert from "node:assert/strict";
import { passwordHash, passwordMatches } from "./passwords.js";
import { scryptSync } from "node:crypto";
test("registration enforces every password requirement and accepts exactly eight characters", async () => {
  for (const password of [
    "Abc12!x",
    "abcdef1!",
    "Abcdefg!",
    "Abcdef12",
    "Abcde12 ",
    "A1!" + "x".repeat(126),
    null,
  ]) {
    await assert.rejects(passwordHash(password), { status: 400 });
  }
  const hash = await passwordHash("Abcdef1!");
  assert.equal(await passwordMatches("Abcdef1!", hash), true);
  assert.equal(await passwordMatches("Wrong123!", hash), false);
  assert.notEqual(await passwordHash("Abcdef1!"), hash);
});
test("existing passwords remain usable at login without the new registration policy", async () => {
  const password = "legacy password",
    salt = "0123456789abcdef0123456789abcdef";
  const stored = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  assert.equal(await passwordMatches(password, stored), true);
});
