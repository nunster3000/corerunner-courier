import { test, expect } from "@playwright/test";
test("sender replaces preparing evidence, dispatch approves ready evidence and assigns courier", async ({
  page,
}) => {
  const data = {
    name: "Grocery Demo",
    email: `groceries-${crypto.randomUUID()}@example.com`,
    phone: "4045550123",
    pickup: "100 Sample Street, Atlanta 30303",
    dropoff: "200 Example Lane, Decatur 30030",
    recipient: "Jamie Demo",
    recipientEmail: "jamie@example.com",
    item: "Groceries",
    weight: 12,
    service: "Same-day",
  };
  await page.goto("/");
  await page.request.post("/api/auth/request", { data });
  const inbox = await (await page.request.get("/api/auth/inbox")).json();
  await page.request.post("/api/auth/verify", { data: { token: inbox.token } });
  const quote = await (await page.request.post("/api/quotes", { data })).json();
  const { booking } = await (
    await page.request.post("/api/bookings", {
      data: { quoteId: quote.id, accepted: true },
      headers: { "Idempotency-Key": crypto.randomUUID() },
    })
  ).json();
  await page.reload();
  await page
    .getByRole("banner")
    .getByRole("button", { name: "My deliveries", exact: true })
    .click();
  const panel = page.getByRole("region", {
    name: `Grocery readiness for ${booking.id}`,
  });
  await panel
    .getByRole("button", { name: "Load sample preparing screen" })
    .click();
  await panel
    .getByRole("button", { name: "Submit for readiness review" })
    .click();
  await expect(panel.getByText("Pending · Demo Market")).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Demo dispatch", exact: true })
    .click();
  await page.getByRole("button", { name: "Enter demo dispatch" }).click();
  await expect(
    panel.getByRole("img", {
      name: "Store pickup confirmation submitted for review",
    }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Approve readiness" }),
  ).toBeDisabled();
  await panel
    .getByLabel("Reason for rejection")
    .fill("Order is still preparing. Please provide ready confirmation.");
  await panel.getByRole("button", { name: "Reject evidence" }).click();
  await expect(panel.getByText("Rejected · Demo Market")).toBeVisible();
  await page
    .getByRole("banner")
    .getByRole("button", { name: "My deliveries", exact: true })
    .click();
  await panel.getByRole("button", { name: "Load sample ready screen" }).click();
  await panel
    .getByRole("button", { name: "Submit for readiness review" })
    .click();
  await expect(panel.getByText("Pending · Demo Market")).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Demo dispatch", exact: true })
    .click();
  await page.getByRole("button", { name: "Enter demo dispatch" }).click();
  await expect(panel.getByRole("checkbox")).toHaveCount(4);
  for (const box of await panel.getByRole("checkbox").all()) await box.check();
  await panel.getByRole("button", { name: "Approve readiness" }).click();
  await expect(panel.getByText("Approved · Demo Market")).toBeVisible();
  const card = page.locator(".delivery-card").filter({ hasText: booking.id });
  await card.locator("select").selectOption("cr-02");
  await card.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(card.getByText("Morgan Reed", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/grocery-review-mobile.png",
    fullPage: true,
  });
});
