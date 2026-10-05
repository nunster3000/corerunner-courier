import { test, expect } from "@playwright/test";
test("visitor starts a guided scenario, navigates roles and resets only generated records", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  await expect(
    page.getByRole("heading", { name: "One delivery. Every perspective." }),
  ).toBeVisible();
  const scenario = page
    .locator(".scenario-card")
    .filter({ hasText: "A package across town" });
  await scenario.getByRole("button", { name: "Create sample booking" }).click();
  await expect(
    page.getByRole("complementary", { name: "Active demo guide" }),
  ).toBeVisible();
  const b = (await (await page.request.get("/api/demo/walkthrough")).json())
    .runs[0].booking;
  await page.getByRole("button", { name: "Next workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Dispatch, in view." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "All scenarios" }).click();
  await expect(
    scenario.getByRole("button", { name: "Resume walkthrough" }),
  ).toBeVisible();
  // This ordinary booking uses the same account but is not marked as a walkthrough record.
  const q = await (
    await page.request.post("/api/quotes", { data: b.delivery })
  ).json();
  const normal = await (
    await page.request.post("/api/bookings", {
      data: { quoteId: q.id, accepted: true },
      headers: { "Idempotency-Key": crypto.randomUUID() },
    })
  ).json();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".scenario-grid")
    .screenshot({ path: "test-results/walkthrough-mobile.png" });
  await expect(
    page.getByRole("button", { name: "Reset walkthrough records" }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /Clear my 1 generated scenario/ })
    .check();
  await page.getByRole("button", { name: "Reset walkthrough records" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Removed 1 walkthrough bookings",
  );
  expect(
    (await page.request.get(`/api/bookings/${normal.booking.id}`)).status(),
  ).toBe(200);
  expect((await page.request.get(`/api/bookings/${b.id}`)).status()).toBe(404);
  await expect(
    page.getByRole("complementary", { name: "Active demo guide" }),
  ).not.toBeVisible();
});
test("keyboard skip link reaches main content and project overview is available", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  await page.getByRole("button", { name: "Explore the guided demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Prepared for a future operator" }),
  ).toBeVisible();
});
