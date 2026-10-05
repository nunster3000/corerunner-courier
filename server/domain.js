import { operator } from "./operator.js";
export class Problem extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const fail = (status, message) => {
  throw new Problem(status, message);
};
export const stamp = () => new Date().toISOString();
export const atlantaDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const email = (value) => {
  const s = String(value || "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) || s.length > 254)
    fail(400, "Enter a valid email address.");
  return s;
};
export const text = (value, label, max = 300) => {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    fail(400, `${label} is required and must be at most ${max} characters.`);
  return value.trim();
};
export function profile(input) {
  return {
    name: text(input.name, "Name", 100),
    email: email(input.email),
    phone: text(input.phone, "Phone", 40),
    pickup: text(input.pickup, "Pickup address"),
  };
}
// Explicit demo fixtures, NOT geocoding or measured road distance. Replace this adapter before deployment.
export function demoZone(address, settings = operator) {
  address = String(address).normalize("NFKC").replace(/\s+/g, " ").trim();
  const z = [...settings.coverage.zones]
    .sort((a, b) => b[0].length - a[0].length)
    .find(([city]) => {
      const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(
        `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
        "iu",
      ).test(address);
    });
  if (!z)
    fail(
      400,
      `Demo coverage supports addresses naming ${settings.coverage.zones.map((z) => z[0]).join(", ")}.`,
    );
  return z;
}
export function formatAddress(value, label = "Address") {
  const address = text(value, label)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
  let city;
  try {
    [city] = demoZone(address);
  } catch (error) {
    error.message = `${label}: ${error.message}`;
    throw error;
  }
  const index = address.toLowerCase().lastIndexOf(city.toLowerCase());
  const street = address.slice(0, index).replace(/[, ]+$/, "");
  const suffix = address
    .slice(index + city.length)
    .replace(/^\s*,?\s*/, "")
    .replace(/^ga\b/i, "GA");
  return [street, city, suffix].filter(Boolean).join(", ");
}
export function delivery(input) {
  const d = {
    pickup: formatAddress(input.pickup, "Pickup address"),
    dropoff: formatAddress(input.dropoff, "Delivery address"),
    recipient: text(input.recipient, "Recipient", 100),
    recipientEmail: email(input.recipientEmail),
    item: text(input.item, "Package type", 60),
    weight: Number(input.weight),
    service: input.service,
    unattended: input.unattended === true,
    date: "",
    window: "",
  };
  if (
    ![
      "Everyday package",
      "Flowers or gifts",
      "Documents or keys",
      "Small-business order",
      "Groceries",
    ].includes(d.item)
  )
    fail(400, "Unsupported package type.");
  if (!Number.isFinite(d.weight) || d.weight <= 0 || d.weight > 50)
    fail(400, "Each package must weigh more than 0 and at most 50 pounds.");
  if (!["Expedited", "Same-day", "Scheduled"].includes(d.service))
    fail(400, "Choose a supported delivery service.");
  if (d.service === "Scheduled") {
    d.date = text(input.date, "Delivery date", 10);
    d.window = text(input.window, "Delivery window", 30);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(d.date) ||
      !Number.isFinite(Date.parse(d.date)) ||
      new Date(d.date).toISOString().slice(0, 10) !== d.date ||
      d.date < atlantaDate()
    )
      fail(400, "Choose a valid delivery date today or later.");
    if (
      ![
        "8–10 a.m.",
        "10 a.m.–1 p.m.",
        "1–4 p.m.",
        "4–6 p.m.",
        "6–8 p.m.",
      ].includes(d.window)
    )
      fail(400, "Choose a delivery window during operating hours.");
  }
  demoZone(d.pickup);
  demoZone(d.dropoff);
  return d;
}
export function price(d, settings = operator) {
  const a = demoZone(d.pickup, settings),
    b = demoZone(d.dropoff, settings);
  const miles = Math.max(
    3,
    Math.round(Math.hypot((a[1] - b[1]) * 69, (a[2] - b[2]) * 57) * 1.3),
  );
  const minutes = Math.ceil(miles * 2.5);
  const base = settings.pricing.baseCents,
    distance = miles * settings.pricing.perMileCents,
    time = minutes * settings.pricing.perMinuteCents,
    expedited = d.service === "Expedited" ? settings.pricing.expeditedCents : 0;
  return {
    version: settings.pricing.version,
    currency: "USD",
    base,
    distance,
    time,
    expedited,
    total: base + distance + time + expedited,
    returnTotal: distance + time,
    miles,
    minutes,
    simulation: true,
    note: "Illustrative rates and city-center route fixtures, not a measured route or live availability.",
  };
}
