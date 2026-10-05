import { test, expect } from "@playwright/test";

test("operator branding and coverage render from backend settings", async ({
  page,
  request,
}) => {
  const response = await request.get("/api/operator");
  expect(response.ok()).toBeTruthy();
  const settings = await response.json();
  settings.brand = {
    ...settings.brand,
    name: "Parcel Path Courier",
    shortName: "Parcel Path",
    primaryColor: "#225533",
    accentColor: "#eecc55",
  };
  settings.coverage = {
    headline: "Sample City & nearby",
    primaryCity: "Sample City",
    zones: [
      ["Sample City", 33, -84],
      ["Nearby Town", 33.1, -84.1],
    ],
  };
  await page.route("**/api/operator", (route) =>
    route.fulfill({ json: settings }),
  );
  await page.goto("/");
  await expect(page).toHaveTitle(
    "Parcel Path Courier | From your door to theirs.",
  );
  await expect(
    page.getByRole("button", { name: "Parcel Path home" }),
  ).toBeVisible();
  await expect(
    page.getByText("Sample City & nearby", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator(".coverage-cities")).toContainText("Nearby Town");
  await expect(page.locator("body")).not.toContainText(/Atlanta/i);
  expect(
    await page
      .locator("html")
      .evaluate((el) => el.style.getPropertyValue("--blue")),
  ).toBe("#225533");
  await page.screenshot({
    path: "test-results/operator-branding.png",
    fullPage: true,
  });
});

test("missing settings show retry instead of booking with fallback company data", async ({
  page,
}) => {
  await page.route("**/api/operator", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Service unavailable" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});
