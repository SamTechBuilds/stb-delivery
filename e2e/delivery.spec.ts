import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { API, IMG, TOKEN, payload } from "./fixtures/payload";
import type { DeliveryPayload } from "../src/types";

const shots = process.env.SHOTS === "1";

async function mock(page: Page, body: DeliveryPayload | { status: number }) {
  const calls: Record<string, unknown>[] = [];
  await page.route(API, async (route) => {
    const req = JSON.parse(route.request().postData() ?? "{}");
    calls.push(req);
    if ("status" in body) return route.fulfill({ status: body.status, contentType: "application/json", body: JSON.stringify({ error: "x" }) });
    if (req.action === "file") return route.fulfill({ json: { url: `${IMG}/download/${req.assetId}`, file_name: "x.pdf" } });
    return route.fulfill({ json: body });
  });
  await page.route(`${IMG}/**`, async (route) => {
    const name = route.request().url().split("/").pop()!.split("?")[0];
    if (route.request().url().includes("/download/")) return route.fulfill({ status: 200, contentType: "application/pdf", body: "%PDF-1.4", headers: { "content-disposition": "attachment" } });
    return route.fulfill({ status: 200, contentType: "image/png", body: readFileSync(join(import.meta.dirname, "fixtures", name)) });
  });
  return calls;
}

test("full unwrapping flow on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const calls = await mock(page, payload());
  await page.goto(`/#${TOKEN}`);
  await expect(page.getByText("Priya", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your new website is ready" })).toBeVisible();
  if (shots) await page.screenshot({ path: "test-results/1-wrapped-mobile.png", fullPage: true });

  await page.getByRole("button", { name: "Open your gift" }).click();
  if (shots) { await page.waitForTimeout(550); await page.screenshot({ path: "test-results/2-opening-mobile.png" }); }
  await expect(page.getByRole("article", { name: "Sam Tech Builds visiting card" })).toBeVisible({ timeout: 4000 });
  await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
  if (shots) { await page.waitForTimeout(800); await page.screenshot({ path: "test-results/3-card-mobile.png", fullPage: true }); }

  const vcf = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save contact" }).click();
  const dl = await vcf;
  expect(dl.suggestedFilename()).toBe("Sam-Tech-Builds.vcf");

  await page.getByRole("button", { name: "See your project" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Priya's Bakehouse website" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Visit priyasbakehouse.example" })).toHaveAttribute("href", "https://priyasbakehouse.example/");
  await expect(page.getByText("Covered until")).toBeVisible();
  if (shots) await page.screenshot({ path: "test-results/4-page-mobile.png", fullPage: true });

  // download asks the gateway for a short-lived URL, then navigates to it
  const pdf = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Owner's guide" }).click();
  await pdf;
  expect(calls.at(-1)).toEqual({ action: "file", token: TOKEN, assetId: "00000000-0000-4000-8000-000000000004" });

  // returning visitors land on the project page directly
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Priya's Bakehouse website" })).toBeVisible();
});

test("desktop layout", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 860 });
  await mock(page, payload());
  await page.goto(`/#${TOKEN}`);
  await expect(page.getByRole("button", { name: "Open your gift" })).toBeVisible();
  if (shots) await page.screenshot({ path: "test-results/5-wrapped-desktop.png" });
  await page.getByRole("button", { name: "Skip to your project" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Priya's Bakehouse website" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  if (shots) await page.screenshot({ path: "test-results/6-page-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  if (shots) await page.screenshot({ path: "test-results/7-lightbox.png" });
});

test("reduced motion skips the animation", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await mock(page, payload());
  await page.goto(`/#${TOKEN}`);
  await page.getByRole("button", { name: "Open your gift" }).click();
  await expect(page.getByRole("button", { name: "See your project" })).toBeVisible({ timeout: 300 });
  await ctx.close();
});

test("themes and preview banner", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const p = payload();
  p.preview = true;
  p.delivery.theme = "aurora";
  await mock(page, p);
  await page.goto(`/#${TOKEN}`);
  await expect(page.getByRole("status")).toContainText("Preview");
  if (shots) await page.screenshot({ path: "test-results/8-aurora-preview.png" });
});

test("ivory theme", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const p = payload();
  p.delivery.theme = "ivory";
  await mock(page, p);
  await page.goto(`/#${TOKEN}`);
  await expect(page.getByRole("button", { name: "Open your gift" })).toBeVisible();
  if (shots) await page.screenshot({ path: "test-results/9-ivory.png" });
});

test("dead links get one clear message", async ({ page }) => {
  await mock(page, { status: 404 });
  await page.goto(`/#${TOKEN}`);
  await expect(page.getByRole("heading", { name: "This link isn't active" })).toBeVisible();
  if (shots) await page.screenshot({ path: "test-results/10-not-found.png" });
  await page.goto(`/`);
  await expect(page.getByRole("heading", { name: "This link isn't active" })).toBeVisible();
});

test("rate limited", async ({ page }) => {
  await mock(page, { status: 429 });
  await page.goto(`/#${TOKEN}`);
  await expect(page.getByRole("heading", { name: "Too many attempts" })).toBeVisible();
});
