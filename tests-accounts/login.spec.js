import { test, expect } from "@playwright/test";
test("visitor creates a password account, logs out and signs back in from another browser", async ({
  page,
  browser,
}) => {
  const email = `persistent-${crypto.randomUUID()}@example.com`,
    password = "Demo account test password 47!";
  await page.goto("/");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Saved Demo Visitor");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Phone number", { exact: true }).fill("4045550123");
  await page
    .getByLabel("Default pickup address", { exact: true })
    .fill("77 Sample Lane, Smyrna, GA 30080");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Verify your email" }),
  ).toBeVisible();
  const unverified = await (await page.request.get("/api/me")).json();
  expect(unverified.user.emailVerified).toBe(false);
  expect((await page.request.get("/api/bookings")).status()).toBe(403);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Verify your email" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open demo inbox" }).click();
  await expect(page.getByRole("heading", { name: "Demo inbox" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/saved-account-demo-inbox.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .getByRole("button", { name: "Simulate email verification" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Verify your email" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Log in", exact: true }),
  ).toBeVisible();
  const context = await browser.newContext();
  const second = await context.newPage();
  await second.goto("http://127.0.0.1:5176/");
  await second.getByRole("button", { name: "Log in", exact: true }).click();
  await second.getByLabel("Email address", { exact: true }).fill(email);
  await second.getByLabel("Password", { exact: true }).fill("wrong password");
  await second
    .locator(".account-access")
    .getByRole("button", { name: "Log in", exact: true })
    .click();
  await expect(second.getByRole("alert")).toContainText(
    "Email or password is incorrect",
  );
  await second.getByLabel("Password", { exact: true }).fill(password);
  await second
    .locator(".account-access")
    .getByRole("button", { name: "Log in", exact: true })
    .click();
  await expect(
    second.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  const me = await (await second.request.get("/api/me")).json();
  expect(me.user.name).toBe("Saved Demo Visitor");
  expect(me.user.persistent).toBe(true);
  expect(me.user.emailVerified).toBe(true);
  await second.setViewportSize({ width: 390, height: 844 });
  await second
    .getByRole("button", { name: "Book a delivery", exact: true })
    .click();
  await expect(
    second.getByLabel("Pickup address", { exact: true }),
  ).toHaveValue("77 Sample Lane, Smyrna, GA 30080");
  expect(
    await second.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await second.screenshot({
    path: "test-results/account-booking-mobile.png",
    fullPage: true,
  });
  await context.close();
});

test("Corey hands registration to the password form without sending the password through chat", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Book with Corey", exact: true })
    .click();
  const email = `corey-saved-${crypto.randomUUID()}@example.com`;
  for (const answer of [
    "start",
    "Corey Saved Visitor",
    email,
    "4045550123",
    "55 Demo Road, Roswell",
    "21 Sample Way, Smyrna",
    "Demo Recipient",
    "recipient@example.com",
    "6",
  ]) {
    await page.getByLabel("Reply to Corey", { exact: true }).fill(answer);
    await page.getByRole("button", { name: "Send reply" }).click();
    await expect(
      page.getByLabel("Reply to Corey", { exact: true }),
    ).toHaveValue("");
    await expect(
      page.getByLabel("Reply to Corey", { exact: true }),
    ).toBeEnabled();
  }
  await page
    .getByRole("button", { name: "Set password & create account" })
    .click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Corey Saved Visitor",
  );
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
    email,
  );
  await page
    .getByLabel("Password", { exact: true })
    .fill("Corey test password only 84!");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("Corey test password only 84!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "Open demo inbox" }).click();
  await page
    .getByRole("button", { name: "Simulate email verification" })
    .click();
  await expect(
    page.getByLabel("Delivery address", { exact: true }),
  ).toHaveValue("21 Sample Way, Smyrna");
  const first = await page.request.post("/api/corey/message", {
    data: { message: "start" },
  });
  expect((await first.json()).pending).toBe("pickup");
  const next = await page.request.post("/api/corey/message", {
    data: { message: "123 Other Street, Atlanta" },
  });
  expect((await next.json()).pending).toBe("dropoff");
});

test("password tracker updates each requirement and confirmation as the visitor types", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Book a delivery", exact: true })
    .click();
  const password = page.getByLabel("Password", { exact: true });
  const rules = page.getByRole("list", { name: "Password requirements" });
  const create = page.getByRole("button", {
    name: "Create account",
    exact: true,
  });
  await expect(
    page.getByText("0 of 4 password requirements met"),
  ).toBeVisible();
  await expect(create).toBeDisabled();
  await password.fill("abcdefgh");
  await expect(
    rules.getByText("At least 8 characters", { exact: false }),
  ).toHaveClass("met");
  await expect(
    page.getByText("1 of 4 password requirements met"),
  ).toBeVisible();
  await password.fill("Abcdefgh");
  await expect(
    page.getByText("2 of 4 password requirements met"),
  ).toBeVisible();
  await password.fill("Abcdefg1");
  await expect(
    page.getByText("3 of 4 password requirements met"),
  ).toBeVisible();
  await password.fill("Abcdef1!");
  await expect(
    page.getByText("4 of 4 password requirements met"),
  ).toBeVisible();
  await expect(create).toBeDisabled();
  await page.getByLabel("Confirm password", { exact: true }).fill("Abcdef1!");
  await expect(
    page.getByText("✓ Passwords match", { exact: true }),
  ).toBeVisible();
  await expect(create).toBeEnabled();
  await password.fill("Abcdef1 ");
  await expect(
    page.getByText("3 of 4 password requirements met"),
  ).toBeVisible();
  await expect(create).toBeDisabled();
  await password.fill("Abcdef1!");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".password-requirements").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/password-requirements-mobile.png",
    fullPage: true,
  });
});
