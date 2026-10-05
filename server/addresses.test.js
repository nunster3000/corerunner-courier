import test from "node:test";
import assert from "node:assert/strict";
import { addressSuggestions, deliveryOptions } from "./addresses.js";
import { formatAddress, price } from "./domain.js";
import { demoReply } from "./corey-demo.js";
const address = "430 Pryor St. Atlanta, GA 30312";
test("Atlanta address without a city comma is formatted and accepted for all service estimates", () => {
  assert.equal(formatAddress(address), "430 Pryor St., Atlanta, GA 30312");
  assert.equal(
    formatAddress("430 Pryor St.  atlanta, ga 30312"),
    "430 Pryor St., Atlanta, GA 30312",
  );
  assert.equal(addressSuggestions(address)[0].address, formatAddress(address));
  const input = { pickup: address, dropoff: "200 Example Lane, Decatur" };
  const { options } = deliveryOptions(input);
  assert.equal(options.length, 3);
  for (const option of options)
    assert.deepEqual(
      option.price,
      price({ ...input, service: option.service }),
    );
  assert.ok(options[1].price.total > options[0].price.total);
  assert.throws(
    () => deliveryOptions({ ...input, pickup: "123 Main Street" }),
    /Pickup address:/,
  );
  assert.throws(
    () => deliveryOptions({ ...input, dropoff: "123 Main Street" }),
    /Delivery address:/,
  );
});
test("demo suggestions retain street and explicitly complete a city", () => {
  assert.equal(
    addressSuggestions("430 Pryor St., Atl")[0].address,
    "430 Pryor St., Atlanta",
  );
  assert.ok(
    addressSuggestions("430 Pryor St.").every((s) =>
      s.address.startsWith("430 Pryor St., "),
    ),
  );
  assert.throws(() => formatAddress("123 Main Street, Boston"), /coverage/);
});
test("Corey recovers missing-city drafts through a direct reply and preserves formatted address", () => {
  const s = {
    draft: { pickup: "123 Main Street", dropoff: address },
    quote: { stale: true },
  };
  let r = demoReply(
    s,
    "quote",
    { id: 1 },
    () => {},
    () => [],
  );
  assert.equal(r.pending, "pickup");
  assert.equal(r.quote, null);
  r = demoReply(
    s,
    address,
    { id: 1 },
    () => {},
    () => [],
  );
  assert.equal(r.draft.pickup, formatAddress(address));
  assert.equal(r.draft.dropoff, formatAddress(address));
  assert.equal(r.pending, "recipient");
});
