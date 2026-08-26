import { expect, test, type Page } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";

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

test("two peers play a shared pair and reset the same round", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", {
    storagePrefix: "mesh-memory-match",
  });
  try {
    await Promise.all([closeInitiallyOpenSettings(a), closeInitiallyOpenSettings(b)]);
    await Promise.all([
      a.getByLabel("Your display name").fill("Ari"),
      b.getByLabel("Your display name").fill("Bea"),
    ]);

    // Peer A opens the first half of a pair; peer B sees the same card through
    // the room's direct Yjs transport before making the matching move.
    await a.getByRole("button", { name: "Card 1, face down" }).click();
    await expect(b.getByRole("button", { name: "Card 1, star" })).toBeVisible({ timeout: 10_000 });

    await b.getByRole("button", { name: "Card 10, face down" }).click();
    await expect(a.getByText("1 of 6 pairs found")).toBeVisible({ timeout: 10_000 });
    await expect(b.getByRole("button", { name: "Card 1, star, matched" })).toBeVisible({
      timeout: 10_000,
    });

    // A reset is a game action too: either peer can begin a fresh shared board.
    await b.getByRole("button", { name: "New round" }).click();
    await expect(a.getByRole("button", { name: "Card 1, face down" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(a.getByText("0 of 6 pairs found")).toBeVisible({ timeout: 10_000 });
  } finally {
    await cleanup();
  }
});
