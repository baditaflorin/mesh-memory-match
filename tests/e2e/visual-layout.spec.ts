import { expect, test, type Page } from "@playwright/test";

async function closeInitiallyOpenSettings(page: Page): Promise<void> {
  const settings = page.getByRole("dialog", { name: "Settings" });
  if (!(await settings.isVisible().catch(() => false))) return;
  const close = settings.getByRole("button", { name: "close" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
  } else {
    await page.keyboard.press("Escape");
  }
  await expect(settings).toBeHidden();
}

async function expectAboveFold(page: Page, label: string, height: number): Promise<void> {
  const control = page.getByRole("button", { name: label });
  await expect(control).toBeVisible();
  const box = await control.boundingBox();
  expect(box, `${label} needs a measurable layout box`).not.toBeNull();
  expect(box!.y, `${label} starts above the fold`).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, `${label} remains actionable above the fold`).toBeLessThanOrEqual(
    height,
  );
}

test("390 × 844 keeps the live game board inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await closeInitiallyOpenSettings(page);

  await expect(page.locator("[data-mesh-app-shell]")).toHaveAttribute(
    "data-mesh-visual-profile",
    "play",
  );
  await expect(page.locator("[data-mesh-app-shell]")).toHaveAttribute(
    "data-mesh-shell-layout",
    "inset",
  );
  await expectAboveFold(page, "New round", 844);
  await expectAboveFold(page, "Card 1, face down", 844);

  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
});

test("1141 × 602 keeps a game action above the short desktop fold", async ({ page }) => {
  await page.setViewportSize({ width: 1141, height: 602 });
  await page.goto("./");
  await closeInitiallyOpenSettings(page);

  await expectAboveFold(page, "New round", 602);
  await expectAboveFold(page, "Card 1, face down", 602);
  await expect(page.getByText("Shared turn 1. Choose a face-down card.")).toBeVisible();
});
