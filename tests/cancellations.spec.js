import { test, expect } from "@playwright/test";
async function booking(page) {
  await page.goto("/");
  const d = {
    name: "Cancellation Demo",
    email: `cancel-${crypto.randomUUID()}@example.com`,
    phone: "4045550123",
    pickup: "100 Sample Street, Atlanta 30303",
    dropoff: "200 Example Lane, Decatur 30030",
    recipient: "Jamie Demo",
    recipientEmail: "jamie@example.com",
    item: "Everyday package",
    weight: 10,
    service: "Expedited",
  };
  await page.request.post("/api/auth/request", { data: d });
  const i = await (await page.request.get("/api/auth/inbox")).json();
  await page.request.post("/api/auth/verify", { data: { token: i.token } });
  const q = await (await page.request.post("/api/quotes", { data: d })).json();
  return (
    await (
      await page.request.post("/api/bookings", {
        data: { quoteId: q.id, accepted: true },
        headers: { "Idempotency-Key": crypto.randomUUID() },
      })
    ).json()
  ).booking;
}
test("customer reviews and confirms free cancellation and sees released authorization", async ({
  page,
}) => {
  const b = await booking(page);
  await page.reload();
  await page
    .getByRole("banner")
    .getByRole("button", { name: "My deliveries", exact: true })
    .click();
  const panel = page.getByRole("region", {
    name: `Cancellation and exceptions for ${b.id}`,
  });
  await panel
    .getByRole("button", { name: "Review cancellation", exact: true })
    .click();
  await expect(
    panel.getByText("Cancellation fee: $0.00", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Confirm cancellation", exact: true }),
  ).toBeDisabled();
  await panel
    .getByRole("checkbox", { name: "I accept these cancellation terms." })
    .check();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/cancellation-mobile.png",
    fullPage: true,
  });
  await panel
    .getByRole("button", { name: "Confirm cancellation", exact: true })
    .click();
  await expect(
    panel.getByText("Cancelled before pickup", { exact: false }),
  ).toBeVisible();
  const r = await (await page.request.get(`/api/bookings/${b.id}`)).json();
  expect(r.booking.paymentStatus).toBe("authorization_released");
  expect(
    r.booking.payments.filter((p) => p.kind === "authorization_release"),
  ).toHaveLength(1);
});
test("dispatch records a company-caused cancellation with no charge", async ({
  page,
}) => {
  const b = await booking(page);
  await page.reload();
  await page
    .getByRole("button", { name: "Demo dispatch", exact: true })
    .click();
  await page.getByRole("button", { name: "Enter demo dispatch" }).click();
  const panel = page.getByRole("region", {
    name: `Cancellation and exceptions for ${b.id}`,
  });
  await panel
    .getByText("Record a CoreRunner-caused failure", { exact: true })
    .click();
  await panel
    .getByLabel("Failure reason")
    .fill("No vehicle available for this demo delivery.");
  await expect(
    panel.getByRole("button", { name: "Confirm company failure" }),
  ).toBeDisabled();
  await panel
    .getByRole("checkbox", {
      name: "I confirm this failure was caused by CoreRunner.",
    })
    .check();
  await panel.getByRole("button", { name: "Confirm company failure" }).click();
  await expect(
    panel.getByText(
      "The authorization was released with no cancellation fee.",
      { exact: false },
    ),
  ).toBeVisible();
});
