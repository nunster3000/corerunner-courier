import { operator } from "./operator.js";
import { demoZone, text, price, formatAddress } from "./domain.js";

export function addressSuggestions(query) {
  const q =
    typeof query === "string"
      ? query.trim().replace(/\s+/g, " ").slice(0, 300)
      : "";
  const cities = operator.coverage.zones.map((z) => z[0]);
  const matching = cities.filter((city) =>
    city.toLowerCase().includes(q.toLowerCase()),
  );
  if (!q || matching.length)
    return (q ? matching : cities).map((city) => ({
      label: `Sample location · ${city}`,
      address: `100 Sample Street, ${city}`,
      detail: "Fictional demo address",
    }));
  try {
    const [city] = demoZone(q);
    return [
      {
        label: formatAddress(q),
        address: formatAddress(q),
        detail: `Demo coverage: ${city} · street not verified`,
      },
    ];
  } catch {
    /* Offer an explicit city choice; never silently guess coverage. */
  }
  const parts = q.split(",");
  const prefix = parts.length > 1 ? parts.at(-1).trim().toLowerCase() : "";
  const partial =
    prefix && cities.filter((city) => city.toLowerCase().startsWith(prefix));
  const entered = {
    label: formatAddress(q),
    address: formatAddress(q),
    detail: "Use this address · demo route, street not verified",
  };
  // Complete only a recognized city prefix. Never append a different city to a full address.
  if (!partial?.length) return [entered];
  const street = parts.slice(0, -1).join(",").trim();
  return partial.map((city) => ({
    label: `${street}, ${city}`,
    address: `${street}, ${city}`,
    detail: `Choose ${city} · demo completion, not a verified address`,
  }));
}

export function deliveryOptions(input) {
  const pickup = text(input.pickup, "Pickup address"),
    dropoff = text(input.dropoff, "Delivery address");
  return {
    options: ["Same-day", "Expedited", "Scheduled"].map((service) => ({
      service,
      price: price({ pickup, dropoff, service }),
    })),
    note: "Estimated demo prices use sample routes for any address; real coverage is not checked. Scheduled availability is checked after you choose a date and window. Your final quote is confirmed before booking.",
  };
}
