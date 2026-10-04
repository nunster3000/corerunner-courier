import { test, expect } from "@playwright/test";
// Only the AI transport is mocked. Verification, quotes, confirmation and persistence use the real local API.
test("AI chat supports verification and confirmed booking without leaving the conversation", async ({
  page,
}) => {
  const draft = {
    name: "Corey Chat Test",
    email: `chat-${crypto.randomUUID()}@example.com`,
    phone: "4045550123",
    pickup: "100 Sample Street, Atlanta 30303",
    dropoff: "200 Example Lane, Decatur 30030",
    recipient: "Jamie Sample",
    recipientEmail: "jamie@example.com",
    item: "Flowers or gifts",
    weight: "8",
    service: "Same-day",
    unattended: false,
  };
  await page.route("**/api/corey/status", (r) =>
    r.fulfill({ json: { available: true, mode: "live-ai" } }),
  );
  let turn = 0;
  await page.route("**/api/corey/message", async (r) => {
    if (turn++ === 0)
      return r.fulfill({
        json: {
          reply: "Please verify your account to continue.",
          draft,
          quote: null,
        },
      });
    const response = await page.request.post("/api/quotes", { data: draft });
    expect(response.status()).toBe(201);
    await r.fulfill({
      json: {
        reply: "Here is your quote. Please review and confirm.",
        draft,
        quote: await response.json(),
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Book with Corey", exact: true })
    .click();
  await page
    .getByLabel("Reply to Corey")
    .fill("Send my flowers from Atlanta to Decatur. Here are my details.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await page
    .getByRole("button", { name: "Verify account", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Simulate email verification" })
    .click();
  await expect(
    page.getByRole("button", { name: "Verify account", exact: true }),
  ).not.toBeVisible();
  await page.getByLabel("Reply to Corey").fill("Prepare my quote");
  await page.getByRole("button", { name: "Send reply" }).click();
  const consent = page.getByRole("checkbox", {
    name: "Allow unattended delivery (photo required)",
  });
  await expect(consent).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Confirm demo booking" }),
  ).toBeDisabled();
  await consent.check();
  await expect(
    page.getByText("You authorize a photographed unattended delivery.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", {
      name: "I accept this demo quote and the return policy.",
    })
    .check();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/corey-quote-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Confirm demo booking" }).click();
  await expect(
    page.getByText("Booking saved ·", { exact: false }),
  ).toBeVisible();
  const deliveries = await (await page.request.get("/api/bookings")).json();
  expect(deliveries.bookings).toHaveLength(1);
  expect(deliveries.bookings[0].delivery.unattended).toBe(true);
  await page.screenshot({
    path: "test-results/corey-booking-mobile.png",
    fullPage: true,
  });
});
test("AI failure preserves typed input and lets the customer continue in the form", async ({
  page,
}) => {
  await page.route("**/api/corey/status", (r) =>
    r.fulfill({ json: { available: true } }),
  );
  await page.route("**/api/corey/message", (r) =>
    r.fulfill({
      status: 503,
      json: { error: "The AI service is at its usage limit." },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Book with Corey", exact: true })
    .click();
  await page.getByLabel("Reply to Corey").fill("Send a package");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "The AI service is at its usage limit.",
  );
  await expect(page.getByLabel("Reply to Corey")).toHaveValue("Send a package");
  await page
    .getByRole("button", { name: "Prefer a form? Continue there" })
    .click();
  await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();
});
