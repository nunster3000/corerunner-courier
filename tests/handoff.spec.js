import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("courier completes PIN and authorized photo handoffs, then a signed return", async ({
  page,
}) => {
  test.setTimeout(60000);
  const body = {
    name: "Handoff Demo",
    email: `handoff-${crypto.randomUUID()}@example.com`,
    phone: "4045550123",
    pickup: "100 Sample Street, Atlanta 30303",
    dropoff: "200 Example Lane, Decatur 30030",
    recipient: "Jamie Sample",
    recipientEmail: "jamie@example.com",
    item: "Everyday package",
    weight: 8,
    service: "Same-day",
    unattended: false,
  };
  async function post(path, data) {
    const response = await page.request.post("/api" + path, {
      data,
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  }
  await post("/auth/request", body);
  const inbox = await (await page.request.get("/api/auth/inbox")).json();
  await post("/auth/verify", { token: inbox.token });
  await post("/demo/dispatch-session", {});
  await post("/demo/courier-session", { courierId: "cr-03" });
  async function delivery() {
    const q = await post("/quotes", body);
    const { booking } = await post("/bookings", {
      quoteId: q.id,
      accepted: true,
    });
    await post(`/dispatch/${booking.id}/assign`, { courierId: "cr-03" });
    for (const status of [
      "heading_to_pickup",
      "picked_up",
      "heading_to_delivery",
    ])
      await post(`/courier/${booking.id}/advance`, { status });
    return booking;
  }
  async function workspace() {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Demo courier", exact: true })
      .click();
  }
  const first = await delivery();
  const mail = await (await page.request.get("/api/inbox")).json();
  const pin = mail.messages
    .find((m) => m.subject === `Delivery PIN for ${first.id}`)
    .body.match(/PIN is (\d{6})/)[1];
  await workspace();
  await page
    .getByRole("button", { name: "Record delivery proof", exact: true })
    .click();
  await page.getByLabel("Recipient PIN", { exact: true }).fill(pin);
  await page
    .getByRole("button", { name: "Complete delivery", exact: true })
    .click();
  await expect(
    page.locator(".completed-jobs").getByText(first.id, { exact: true }),
  ).toBeVisible();
  const second = await delivery();
  await post(`/courier/${second.id}/advance`, { status: "handoff_failed" });
  await post(`/courier/${second.id}/contact-sender`, {});
  await page
    .getByRole("button", { name: "My deliveries", exact: true })
    .first()
    .click();
  const senderCard = page
    .locator(".delivery-card")
    .filter({ hasText: second.id });
  await senderCard
    .getByRole("checkbox", {
      name: `I authorize unattended delivery for ${second.id}.`,
    })
    .check();
  await senderCard
    .getByRole("button", { name: "Authorize unattended delivery", exact: true })
    .click();
  await expect(
    senderCard.getByText("Unattended · photo required", { exact: true }),
  ).toBeVisible();
  await workspace();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Record delivery proof", exact: true })
    .click();
  const photo = readFileSync(
    new URL("./fixtures/delivery.png", import.meta.url),
  );
  await page
    .getByLabel("Delivery photo", { exact: true })
    .setInputFiles({
      name: "sample-delivery.png",
      mimeType: "image/png",
      buffer: photo,
    });
  await page
    .getByRole("checkbox", { name: /I confirm the package is at a suitable/ })
    .check();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/courier-photo-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Complete delivery", exact: true })
    .click();
  await expect(
    page.locator(".completed-jobs").getByText(second.id, { exact: true }),
  ).toBeVisible();
  const secondCard = page
    .locator(".completed-jobs .delivery-card")
    .filter({ hasText: second.id });
  await secondCard
    .getByRole("button", { name: "Delivery proof · photo" })
    .click();
  await expect(
    secondCard.getByRole("img", { name: "Recorded delivery photo" }),
  ).toBeVisible();
  const third = await delivery();
  await post(`/courier/${third.id}/advance`, { status: "handoff_failed" });
  await workspace();
  await page
    .getByRole("button", { name: "Start return now", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Record return handoff", exact: true })
    .click();
  await page.getByLabel("Receiving person’s name").fill("Handoff Demo");
  const pad = page.getByLabel("Draw recipient signature");
  await pad.scrollIntoViewIfNeeded();
  const box = await pad.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 50, box.y + 80, { steps: 6 });
  await page.mouse.move(box.x + 100, box.y + 35, { steps: 8 });
  await page.mouse.move(box.x + 150, box.y + 75, { steps: 8 });
  await page.mouse.up();
  await page
    .getByRole("checkbox", {
      name: "I am the receiving person and confirm that I have received this package.",
    })
    .check();
  await page.screenshot({
    path: "test-results/courier-return-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Confirm signed return", exact: true })
    .click();
  await expect(
    page.locator(".completed-jobs").getByText(third.id, { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/courier-desktop.png",
    fullPage: true,
  });
  const record = await (
    await page.request.get("/api/bookings/" + third.id)
  ).json();
  expect(record.booking.status).toBe("returned");
  expect(
    record.booking.payments.filter((p) => p.kind === "return_charge"),
  ).toHaveLength(1);
});
