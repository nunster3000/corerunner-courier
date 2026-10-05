import { readFileSync } from "node:fs";

export function validateOperator(value) {
  const invalid = (message) => {
    throw new Error(`Invalid operator settings: ${message}`);
  };
  if (!value || typeof value !== "object") invalid("expected an object");
  const { brand, coverage, pricing } = value;
  for (const [key, item] of Object.entries({
    name: brand?.name,
    shortName: brand?.shortName,
    descriptor: brand?.descriptor,
    headline: coverage?.headline,
    primaryCity: coverage?.primaryCity,
    version: pricing?.version,
  })) {
    if (
      typeof item !== "string" ||
      !item.trim() ||
      item !== item.trim() ||
      item.length > 100
    )
      invalid(`${key} must be 1–100 characters without surrounding spaces`);
  }
  for (const key of ["primaryColor", "accentColor"]) {
    if (!/^#[0-9a-f]{6}$/i.test(brand[key]))
      invalid(`${key} must be a six-digit hex color`);
  }
  if (
    !Array.isArray(coverage.zones) ||
    coverage.zones.length < 1 ||
    coverage.zones.length > 50
  )
    invalid("provide 1–50 coverage zones");
  const names = new Set();
  for (const zone of coverage.zones) {
    if (!Array.isArray(zone) || zone.length !== 3)
      invalid("zones require name, latitude and longitude");
    const [name, lat, lng] = zone;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name !== name.trim() ||
      name.length > 80 ||
      names.has(name.toLowerCase())
    )
      invalid("zone names must be unique and 1–80 characters");
    if (
      !Number.isFinite(lat) ||
      Math.abs(lat) > 90 ||
      !Number.isFinite(lng) ||
      Math.abs(lng) > 180
    )
      invalid("zone coordinates are invalid");
    names.add(name.toLowerCase());
  }
  if (!names.has(coverage.primaryCity.toLowerCase()))
    invalid("primaryCity must name a coverage zone");
  for (const key of [
    "baseCents",
    "perMileCents",
    "perMinuteCents",
    "expeditedCents",
  ]) {
    if (
      !Number.isSafeInteger(pricing[key]) ||
      pricing[key] < 0 ||
      pricing[key] > 100000
    )
      invalid(`${key} must be an integer from 0 to 100000 cents`);
  }
  // Explicit allowlist: this endpoint can never publish arbitrary added credentials.
  return {
    brand: Object.fromEntries(
      ["name", "shortName", "descriptor", "primaryColor", "accentColor"].map(
        (key) => [key, brand[key]],
      ),
    ),
    coverage: {
      headline: coverage.headline,
      primaryCity: coverage.primaryCity,
      zones: coverage.zones.map((zone) => [...zone]),
    },
    pricing: Object.fromEntries(
      [
        "version",
        "baseCents",
        "perMileCents",
        "perMinuteCents",
        "expeditedCents",
      ].map((key) => [key, pricing[key]]),
    ),
  };
}
export const operator = validateOperator(
  JSON.parse(
    readFileSync(new URL("../config/operator.json", import.meta.url), "utf8"),
  ),
);
