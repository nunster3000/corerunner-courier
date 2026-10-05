import { test, expect } from "@playwright/test";
async function account(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Let’s get it delivered" }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Alex Sample");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(`alex-${crypto.randomUUID()}@example.com`);
  await page.getByLabel("Phone number", { exact: true }).fill("4045550123");
  await page
    .getByLabel("Default pickup address", { exact: true })
    .fill("430 Pryor St. Atlanta, GA 30312");
  await expect(
    page.getByRole("option", { name: /430 Pryor St., Atlanta, GA 30312/ }),
  ).toBeVisible();
  await page
    .getByLabel("Default pickup address", { exact: true })
    .press("ArrowDown");
  await page
    .getByLabel("Default pickup address", { exact: true })
    .press("Enter");
  await expect(
    page.getByLabel("Default pickup address", { exact: true }),
  ).toHaveValue("430 Pryor St., Atlanta, GA 30312");
  await page.getByRole("button", { name: "Demo inbox" }).click();
  await page
    .getByRole("button", { name: "Simulate email verification" })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("Delivery address", { exact: true })
    .fill("200 Example Lane, Decatur, GA 30030");
  await page.getByLabel("Recipient’s name").fill("Jamie Sample");
  await page.getByLabel("Recipient’s email").fill("jamie@example.com");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}
test("booking requires verification, valid weight and preserves default handoff", async ({
  page,
}) => {
  await account(page);
  await expect(
    page.getByRole("checkbox", { name: "Allow unattended delivery" }),
  ).not.toBeChecked();
  await page.getByLabel("Package weight in pounds").fill("51");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "What are we carrying?" }),
  ).toBeVisible();
  await page.getByLabel("Package weight in pounds").fill("12");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  for (const service of ["Same-day", "Expedited", "Scheduled"]) {
    await expect(
      page.getByRole("radio", { name: new RegExp(service + ".*\\$", "s") }),
    ).toBeVisible();
  }
  await page.getByRole("radio", { name: /Scheduled/ }).check();
  await page
    .getByLabel("Delivery date")
    .fill(new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByText("Signature or recipient PIN required", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Your demo quote", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", {
      name: "I accept this demo quote and the return policy.",
    })
    .check();
  await page.getByRole("button", { name: "Confirm demo booking" }).click();
  await expect(
    page.getByText("Your demo booking is saved to the backend.", {
      exact: false,
    }),
  ).toBeVisible();
});
test("groceries remain pending and unattended delivery is explicit", async ({
  page,
}) => {
  await account(page);
  await page.getByLabel("Package type").selectOption("Groceries");
  await page.getByLabel("Package weight in pounds").fill("15");
  await page
    .getByRole("checkbox", { name: "Allow unattended delivery" })
    .check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByText("Readiness review pending.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Unattended authorized · photo required"),
  ).toBeVisible();
});
test("Corey runs as a scripted demo without a key", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Book with Corey", exact: true })
    .click();
  await expect(
    page.getByText("Scripted portfolio demo", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Reply to Corey")).toBeEnabled();
  await page
    .getByRole("button", { name: "Prefer a form? Continue there" })
    .click();
  await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();
});
test("homepage and mobile booking render without overflow or runtime errors", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Book a delivery", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/booking-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("saved booking survives refresh and dispatch status reaches recipient without an account", async ({
  page,
  browser,
}) => {
  await account(page);
  await page.getByLabel("Package weight in pounds").fill("8");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: "I accept this demo quote and the return policy.",
    })
    .check();
  await page.getByRole("button", { name: "Confirm demo booking" }).click();
  await page.getByRole("button", { name: "View my deliveries" }).click();
  const card = page.locator(".delivery-card").first();
  const id = await card.locator(".delivery-id").textContent();
  const link = await card
    .getByRole("link", { name: "Open recipient tracking" })
    .getAttribute("href");
  await page.reload();
  await page
    .getByRole("button", { name: "My deliveries", exact: true })
    .first()
    .click();
  await expect(page.getByText(id, { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/deliveries-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Demo dispatch", exact: true })
    .click();
  await page.getByRole("button", { name: "Enter demo dispatch" }).click();
  const dispatchCard = page.locator(".delivery-card").filter({ hasText: id });
  await dispatchCard.getByLabel("Courier for " + id).selectOption("cr-01");
  await dispatchCard
    .getByRole("button", { name: "Assign", exact: true })
    .click();
  await dispatchCard
    .getByRole("button", { name: "Heading to pickup", exact: true })
    .click();
  await dispatchCard
    .getByRole("button", { name: "Picked up", exact: true })
    .click();
  await expect(dispatchCard.getByText("Captured · simulated")).toBeVisible();
  await page.screenshot({
    path: "test-results/dispatch-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/dispatch-mobile.png",
    fullPage: true,
  });
  const context = await browser.newContext();
  try {
    const recipient = await context.newPage();
    await recipient.goto(new URL(link, page.url()).href);
    await expect(
      recipient.getByRole("heading", { name: "Picked up", exact: true }),
    ).toBeVisible();
    await expect(
      recipient.getByText("Simulated route and location, not phone GPS", {
        exact: false,
      }),
    ).toBeVisible();
    await page.request.post("/api/demo/courier-session", {
      data: { courierId: "cr-01" },
    });
    await page.goto("/");
    await page
      .getByRole("button", { name: "Demo courier", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Head to recipient", exact: true })
      .click();
    await page.getByRole("button", { name: "Advance demo location" }).click();
    await expect(
      recipient.getByRole("progressbar", { name: "Simulated route progress" }),
    ).toHaveAttribute("value", "20", { timeout: 10000 });
    await page.getByRole("button", { name: "Pause demo tracking" }).click();
    await expect(
      recipient.getByText("Updates paused", { exact: false }),
    ).toBeVisible({ timeout: 10000 });
    expect((await recipient.request.get("/api/bookings")).status()).toBe(401);
    await recipient.setViewportSize({ width: 390, height: 844 });
    expect(
      await recipient.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await recipient.screenshot({
      path: "test-results/tracking-mobile.png",
      fullPage: true,
    });
  } finally {
    await context.close();
  }
});
