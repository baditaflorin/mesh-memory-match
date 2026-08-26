export default async function screenshotScenario(page) {
  await page.getByRole("button", { name: "Card 1, face down" }).click();
  await page.getByRole("button", { name: "Card 10, face down" }).click();
  await page.getByText("1 of 6 pairs found").waitFor({ timeout: 10_000 });
}
