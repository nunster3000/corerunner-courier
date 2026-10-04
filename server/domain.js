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
const zones = [
  ["Peachtree City", 33.396, -84.596],
  ["Lawrenceville", 33.957, -83.988],
  ["Alpharetta", 34.075, -84.294],
  ["Marietta", 33.952, -84.55],
  ["Decatur", 33.774, -84.296],
  ["Atlanta", 33.749, -84.388],
];
export function demoZone(address) {
  const z = zones.find(([city]) =>
    new RegExp(`\\b${city}\\b`, "i").test(address),
  );
  if (!z)
    fail(
      400,
      "Demo coverage supports addresses naming Atlanta, Decatur, Marietta, Alpharetta, Lawrenceville, or Peachtree City.",
    );
  return z;
}
export function delivery(input) {
  const d = {
    pickup: text(input.pickup, "Pickup address"),
    dropoff: text(input.dropoff, "Delivery address"),
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
export function price(d) {
  const a = demoZone(d.pickup),
    b = demoZone(d.dropoff);
  const miles = Math.max(
    3,
    Math.round(Math.hypot((a[1] - b[1]) * 69, (a[2] - b[2]) * 57) * 1.3),
  );
  const minutes = Math.ceil(miles * 2.5);
  const base = 500,
    distance = miles * 125,
    time = minutes * 20,
    expedited = d.service === "Expedited" ? 800 : 0;
  return {
    version: "demo-rates-v1",
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
