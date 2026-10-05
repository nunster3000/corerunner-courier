import test from "node:test";
import assert from "node:assert/strict";
import { operator, validateOperator } from "./operator.js";
import { demoZone, price } from "./domain.js";

test("operator settings reject invalid rates, colors and coverage without leaking extra fields", () => {
  for (const mutate of [
    (s) => (s.pricing.baseCents = -1),
    (s) => (s.pricing.perMileCents = 1.5),
    (s) => (s.pricing.expeditedCents = "800"),
    (s) => (s.brand.primaryColor = "url(https://example.com)"),
    (s) => (s.brand.name = " "),
    (s) => (s.coverage.zones = []),
    (s) => s.coverage.zones.push(["ATLANTA", 0, 0]),
    (s) => (s.coverage.zones[0][1] = 91),
    (s) => (s.coverage.primaryCity = "Unsupported"),
  ]) {
    const settings = structuredClone(operator);
    mutate(settings);
    assert.throws(
      () => validateOperator(settings),
      /Invalid operator settings/,
    );
  }
  const settings = structuredClone(operator);
  settings.secret = "never public";
  settings.brand.apiKey = "never public";
  assert.deepEqual(validateOperator(settings), operator);
});

test("custom operator coverage matches literal names and calculates configured prices", () => {
  const settings = validateOperator({
    brand: { ...operator.brand, name: "Parcel Company" },
    coverage: {
      headline: "Sample region",
      primaryCity: "St. Test",
      zones: [
        ["St. Test", 33.7, -84.3],
        ["North (Demo)", 33.8, -84.4],
      ],
    },
    pricing: {
      version: "buyer-v2",
      baseCents: 700,
      perMileCents: 150,
      perMinuteCents: 30,
      expeditedCents: 1000,
    },
  });
  assert.equal(demoZone("12 Sample Street, st. test", settings)[0], "St. Test");
  assert.equal(
    demoZone("12 Sample Street, North (Demo)", settings)[0],
    "North (Demo)",
  );
  assert.throws(() => demoZone("StX Test", settings), /Demo coverage/);
  assert.throws(() => demoZone("EastSt. Testville", settings), /Demo coverage/);
  assert.throws(() => demoZone("Atlanta", settings), /Demo coverage/);
  const quote = price(
    { pickup: "St. Test", dropoff: "North (Demo)", service: "Expedited" },
    settings,
  );
  assert.equal(quote.base, 700);
  assert.equal(quote.expedited, 1000);
  assert.equal(quote.distance, quote.miles * 150);
  assert.equal(quote.time, quote.minutes * 30);
  assert.equal(quote.total, 1700 + quote.distance + quote.time);
  assert.equal(quote.returnTotal, quote.distance + quote.time);
  assert.equal(quote.version, "buyer-v2");
  settings.pricing.baseCents = 999;
  assert.equal(quote.base, 700, "existing price snapshot stays unchanged");
});
