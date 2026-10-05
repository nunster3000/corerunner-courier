import { test, expect } from "@playwright/test";

test("hosted access screen explains sample data and handles incorrect access passwords", async ({
  page,
}) => {
  await page.route("**/api/operator", (route) =>
    route.fulfill({
      status: 401,
      json: { code: "DEMO_ACCESS_REQUIRED", error: "Access required" },
    }),
  );
  await page.route("**/api/demo-access", (route) =>
    route.fulfill({
      status: 401,
      json: { error: "That demo access password is incorrect." },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "A delivery business, ready to explore.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/Workspaces expire after two hours/),
  ).toBeVisible();
  await page.getByLabel("Demo access password").fill("incorrect");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "That demo access password is incorrect.",
  );
  await expect(
    page.getByRole("button", { name: "Explore the demo" }),
  ).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/hosted-access-mobile.png",
    fullPage: true,
  });
});
