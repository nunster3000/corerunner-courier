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
    .getByLabel("Default pickup address")
    .fill("100 Sample Street, Atlanta, GA 30303");
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
test("Corey carries conversational details into manual registration", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Book with Corey", exact: true })
    .click();
  for (const answer of [
    "Alex Sample",
    "alex@example.com",
    "4045550123",
    "100 Sample St, Atlanta 30303",
    "200 Example St, Decatur 30030",
    "Jamie",
    "jamie@example.com",
  ]) {
    await page.getByLabel("Reply to Corey").fill(answer);
    await page.getByRole("button", { name: "Send reply" }).click();
  }
  await page.getByRole("button", { name: "Review delivery details" }).click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Alex Sample",
  );
  await expect(page.getByLabel("Default pickup address")).toHaveValue(
    "100 Sample St, Atlanta 30303",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    /verify your preview account/,
  );
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
      recipient.getByText(
        "Phone GPS and arrival estimates are not connected.",
        { exact: false },
      ),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
