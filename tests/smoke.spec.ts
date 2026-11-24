import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data-e2e");
const EMAIL = `smoke${Date.now()}@example.com`;
const PASSWORD = "smokepass1234";

test.beforeAll(async () => {
  await fs.rm(DATA_DIR, { recursive: true, force: true }).catch(() => undefined);
});

test("creator and moderator journey", async ({ page, context }) => {
  // ---- signup ----
  await page.goto("/signup");
  await page.getByLabel("Artist name").fill("Smoke Tester");
  await page.getByLabel("Gmail address").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: /create account/i }).click();

  // ---- verify via the scoped dev inbox ----
  await expect(page).toHaveURL(/\/verify/);
  await page.getByRole("button", { name: /verify my email/i }).first().click();
  await expect(page.getByRole("heading", { name: /email verified/i })).toBeVisible();

  // ---- login ----
  await page.getByRole("button", { name: /continue to login/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page).toHaveURL(/\/($|\?)/);

  // ---- post a YouTube track ----
  await page.goto("/create");
  await page.getByPlaceholder("Neon Reverie").fill("Smoke Test Track");
  await page.getByRole("tab", { name: /youtube embed/i }).click();
  await page.getByPlaceholder("https://www.youtube.com/watch?v=…").fill("https://www.youtube.com/watch?v=jfKfPfyJRdk");
  await page.getByPlaceholder(/driving home at 1am/i).fill("A smoke test track created by the automated suite to verify the publishing path end to end.");
  await page.getByPlaceholder(/synthwave, 100 BPM/i).fill("smoke test, automated, verification");
  await page.locator(".trust-attest").click();
  await page.getByRole("button", { name: /publish to the feed/i }).click();

  await expect(page).toHaveURL(/\/\?new=/);
  await expect(page.getByText("Smoke Test Track").first()).toBeVisible();

  // ---- open the track page, play, comment, like, save ----
  await page.getByRole("link", { name: "Smoke Test Track" }).first().click();
  await expect(page).toHaveURL(/\/track\//);
  const trackUrl = page.url();

  await page.getByRole("button", { name: /play track/i }).click();
  await expect(page.locator(".pbar")).toBeVisible();

  await page.getByPlaceholder("Add a comment…").fill("Automated smoke comment.");
  await page.getByPlaceholder("Add a comment…").press("Enter");
  await expect(page.getByText("Automated smoke comment.")).toBeVisible();

  await page.getByRole("button", { name: /^like$/i }).click();
  await expect(page.getByRole("button", { name: /liked/i })).toBeVisible();
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByRole("button", { name: /saved/i })).toBeVisible();

  // ---- report someone else's track ----
  await page.goto("/track/t-neon");
  await page.getByRole("button", { name: /report this track/i }).click();
  await page.getByPlaceholder(/Name the work you own|Describe the problem/i)
    .fill("Automated smoke report to verify the moderation queue receives new cases.");
  await page.getByRole("button", { name: /file report/i }).click();
  await expect(page.getByText(/report received/i)).toBeVisible();

  // ---- delete own track, then undo ----
  await page.goto(trackUrl);
  await page.getByRole("button", { name: /^delete$/i }).click();
  await page.getByRole("button", { name: /^delete$/i }).last().click();
  await expect(page).toHaveURL(/\/($|\?)/);
  await page.getByRole("button", { name: /^undo$/i }).click();
  await page.goto(trackUrl);
  await expect(page.getByRole("heading", { name: "Smoke Test Track" })).toBeVisible();

  // ---- moderator: demo account, queue, dismiss, undo ----
  await context.clearCookies();
  await page.goto("/login");
  await page.getByRole("button", { name: /enter the demo studio/i }).click();
  await expect(page).toHaveURL(/\/($|\?)/);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: /^moderation$/i })).toBeVisible();
  await page.getByRole("button", { name: /everything/i }).click();

  const reviewButtons = page.getByRole("button", { name: /^review$/i });
  await expect(reviewButtons.first()).toBeVisible();
  await reviewButtons.first().click();

  await page.getByPlaceholder(/Explain the decision/i).fill("Automated dismissal from the smoke suite.");
  await page.getByRole("button", { name: /dismiss report/i }).click();
  await expect(page.getByText(/dismissed/i).first()).toBeVisible();

  await page.getByRole("button", { name: /^undo$/i }).first().click();
  await expect(page.getByText(/reverted/i).first()).toBeVisible();

  // ---- health ----
  const health = await page.request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  const body = await health.json();
  expect(body.checks.db.mode).toBe("local");
  expect(body.checks.db.ok).toBe(true);
});