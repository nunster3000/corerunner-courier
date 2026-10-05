import { test, expect } from "@playwright/test";
test("dispatch shift availability reaches the booking date capacity view", async ({
  page,
}) => {
  const date = "2099-07-15";
  await page.goto("/");
  await page
    .getByRole("button", { name: "Demo dispatch", exact: true })
    .click();
  await page.getByRole("button", { name: "Enter demo dispatch" }).click();
  await page
    .getByText("Courier schedule and availability", { exact: true })
    .click();
  await page.getByLabel("Schedule date", { exact: true }).fill(date);
  const card = page.locator(".shift-card").filter({ hasText: "Jordan Ellis" });
  await expect(
    card.getByRole("checkbox", { name: "On duty", exact: true }),
  ).toBeChecked();
  await card.getByRole("checkbox", { name: "On duty", exact: true }).uncheck();
  await card.getByRole("button", { name: "Save shift" }).click();
  await expect(
    page
      .locator(".availability-grid")
      .getByText("2 slots available", { exact: true }),
  ).toHaveCount(5);
  expect(
    (
      await (await page.request.get(`/api/availability?date=${date}`)).json()
    ).windows.every((w) => w.available === 2),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".schedule-board").screenshot({
    path: "test-results/schedule-mobile.png",
  });
});
