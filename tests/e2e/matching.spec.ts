import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";

test("a card revealed by one peer appears for another peer", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", {
    storagePrefix: "mesh-memory-match",
  });
  try {
    await a.getByLabel("Your display name").fill("Ari");
    await b.getByLabel("Your display name").fill("Bea");
    await a.getByRole("button", { name: "Card 1, face down" }).click();
    await expect(b.getByRole("button", { name: "Card 1, star" })).toBeVisible({ timeout: 10_000 });

    await b.getByRole("button", { name: "Card 10, face down" }).click();
    await expect(a.getByText("1 of 6 pairs found")).toBeVisible({ timeout: 10_000 });
  } finally {
    await cleanup();
  }
});
