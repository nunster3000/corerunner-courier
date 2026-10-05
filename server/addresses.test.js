import test from "node:test";
import assert from "node:assert/strict";
import { addressSuggestions, deliveryOptions } from "./addresses.js";
import { formatAddress, price, delivery } from "./domain.js";
import { demoReply } from "./corey-demo.js";
import { trackingView } from "./tracking.js";
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
    () => deliveryOptions({ ...input, pickup: "" }),
    /Pickup address/,
  );
  assert.throws(
    () => deliveryOptions({ ...input, dropoff: "" }),
    /Delivery address/,
  );
});
test("demo suggestions retain street and explicitly complete a city", () => {
  assert.equal(
    addressSuggestions("430 Pryor St., Atl")[0].address,
    "430 Pryor St., Atlanta",
  );
  assert.equal(
    addressSuggestions("123 Main Street, Boston")[0].address,
    "123 Main Street, Boston",
  );
  assert.equal(
    addressSuggestions("123 Main Street")[0].address,
    "123 Main Street",
  );
});
test("any demo address survives Corey, quoting and tracking without city restrictions", () => {
  for (const address of [
    "27 Test Lane, Smyrna, ga 30080",
    "84 Example Road, Dunwoody, GA 30338",
    "19 Oak Avenue, Boston, MA 02108",
    "Unit 4, 62 Demo Road",
    "88 Fictional Lane 30312",
    "91 Main Road, 東京",
    "100 Sample Street, Marietta",
  ]) {
    const s = { draft: { pickup: address, dropoff: address } };
    const r = demoReply(
      s,
      "quote",
      { id: 1 },
      () => {},
      () => [],
    );
    assert.equal(r.pending, "recipient");
    assert.equal(r.draft.pickup, formatAddress(address));
    const options = deliveryOptions({ pickup: address, dropoff: address });
    assert.equal(options.options.length, 3);
    assert.ok(
      options.options.every((o) => o.price.total > 0 && o.price.simulation),
    );
    const d = delivery({
      pickup: address,
      dropoff: address,
      recipient: "Demo",
      recipientEmail: "demo@example.com",
      item: "Everyday package",
      weight: 5,
      service: "Same-day",
    });
    assert.equal(d.dropoff, formatAddress(address));
    assert.doesNotThrow(() =>
      trackingView({
        delivery: d,
        status: "heading_to_delivery",
        price: options.options[0].price,
      }),
    );
  }
});
