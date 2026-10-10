import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const axeSource = readFileSync(new URL("./node_modules/axe-core/axe.min.js", import.meta.url), "utf8");

test("all lanes render the frozen cases and recover from malformed components", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".lane")).toHaveCount(5);
  for (const scenario of ["diagnosis", "comparison", "approval"]) {
    await page.getByLabel("Scenario").selectOption(scenario);
    for (const name of ["Existing parser", "json-render", "OpenUI", "assistant-ui", "A2UI"]) {
      await expect(page.locator(`[data-lane="${name}"]`)).not.toBeEmpty();
    }
  }
  await page.getByLabel("Malformed component").check();
  await expect(page.locator(".lane .fallback")).toHaveCount(4);
  await expect(page.locator('[data-lane="Existing parser"]')).toContainText("Widget fallback");
});

test("mobile viewport fits and has no serious accessibility violations", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Scenario").selectOption("approval");
  await expect(page.locator(".lane")).toHaveCount(5);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => {
    // @ts-expect-error injected axe runtime
    const results = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return results.violations.filter((v: { impact: string }) => ["serious", "critical"].includes(v.impact));
  });
  expect(violations).toEqual([]);
});
