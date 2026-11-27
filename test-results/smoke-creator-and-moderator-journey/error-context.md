# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> creator and moderator journey
- Location: tests\smoke.spec.ts:13:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Smoke Test Track', level: 1 })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'Smoke Test Track', level: 1 }) with timeout 15000ms
  - waiting for getByRole('heading', { name: 'Smoke Test Track', level: 1 })

```

```yaml
- banner:
  - link "I Love AI Music — home":
    - /url: /
    - text: I Love
    - emphasis: AI Music
  - navigation "Primary":
    - link "Feed":
      - /url: /
      - img
      - text: Feed
    - link "Post music":
      - /url: /create
      - img
      - text: Post music
  - button "Mute all sound":
    - img
  - link "Post music":
    - /url: /create
    - img
    - text: Post music
  - button "More options":
    - img "Smoke Tester"
- complementary "Sidebar":
  - navigation:
    - link "Home":
      - /url: /
      - img
      - text: Home
    - link "Explore":
      - /url: /?focus=search
      - img
      - text: Explore
    - link "Create":
      - /url: /create
      - img
      - text: Create
    - link "Saved":
      - /url: /?view=saved
      - img
      - text: Saved
    - link "Profile":
      - /url: /profile/smoketester
      - img
      - text: Profile
  - link "Post music":
    - /url: /create
    - img
    - text: Post music
  - link "Smoke Tester Smoke Tester @smoketester":
    - /url: /profile/smoketester
    - img "Smoke Tester"
    - strong: Smoke Tester
    - emphasis: "@smoketester"
  - text: 7 tracks · 6 artists I Love AI Music © 2026
- main:
  - img
  - heading "This track faded out" [level=3]
  - paragraph: It may have been deleted, or it only exists in another browser's local studio. The feed still has plenty of sound.
  - link "Back to the feed":
    - /url: /
    - img
    - text: Back to the feed
- slider "Seek": "0"
- button "Previous track":
  - img
- button "Play":
  - img
- button "Next track":
  - img
- button "Repeat one off":
  - img
- text: "--:--"
- slider "Seek": "0"
- text: "--:--"
- button "Mute":
  - img
- slider "Volume": "85"
- status
- alert
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import { promises as fs } from "node:fs";
  3   | import path from "node:path";
  4   | 
  5   | const DATA_DIR = path.join(process.cwd(), ".data-e2e");
  6   | const EMAIL = `smoke${Date.now()}@example.com`;
  7   | const PASSWORD = "smokepass1234";
  8   | 
  9   | test.beforeAll(async () => {
  10  |   await fs.rm(DATA_DIR, { recursive: true, force: true }).catch(() => undefined);
  11  | });
  12  | 
  13  | test("creator and moderator journey", async ({ page, context }) => {
  14  |   // ---- signup ----
  15  |   await page.goto("/signup");
  16  |   await page.getByLabel("Artist name").fill("Smoke Tester");
  17  |   await page.getByLabel("Gmail address").fill(EMAIL);
  18  |   await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  19  |   await page.getByLabel("Confirm password").fill(PASSWORD);
  20  |   await page.getByRole("button", { name: /create account/i }).click();
  21  | 
  22  |   // ---- verify via the scoped dev inbox ----
  23  |   await expect(page).toHaveURL(/\/verify/);
  24  |   await page.getByRole("button", { name: /verify my email/i }).first().click();
  25  |   await expect(page.getByRole("heading", { name: /email verified/i })).toBeVisible();
  26  | 
  27  |   // ---- login ----
  28  |   await page.getByRole("button", { name: /continue to login/i }).click();
  29  |   await expect(page).toHaveURL(/\/login/);
  30  |   await page.locator("#li-pass").fill(PASSWORD);
  31  |   await page.getByRole("button", { name: /^log in$/i }).click();
  32  |   await expect(page).toHaveURL(/\/($|\?)/);
  33  | 
  34  |   // ---- post a YouTube track ----
  35  |   await page.goto("/create");
  36  |   await page.getByPlaceholder("Neon Reverie").fill("Smoke Test Track");
  37  |   await page.getByRole("tab", { name: /youtube embed/i }).click();
  38  |   await page.getByPlaceholder("https://www.youtube.com/watch?v=…").fill("https://www.youtube.com/watch?v=jfKfPfyJRdk");
  39  |   await page.getByPlaceholder(/driving home at 1am/i).fill("A smoke test track created by the automated suite to verify the publishing path end to end.");
  40  |   await page.getByPlaceholder(/synthwave, 100 BPM/i).fill("smoke test, automated, verification");
  41  |   await page.locator(".trust-attest").click();
  42  |   await page.getByRole("button", { name: /publish to the feed/i }).click();
  43  | 
  44  |   await expect(page).toHaveURL(/\/\?new=/);
  45  |   await expect(page.getByText("Smoke Test Track").first()).toBeVisible();
  46  | 
  47  |   // ---- open the track page, play, comment, like, save ----
  48  |   await page.getByRole("link", { name: "Smoke Test Track" }).first().click();
  49  |   await expect(page).toHaveURL(/\/track\//);
  50  |   const trackUrl = page.url();
  51  | 
  52  |   await page.getByRole("button", { name: /play track/i }).click();
  53  |   await expect(page.locator(".pbar")).toBeVisible();
  54  | 
  55  |   await page.getByPlaceholder("Add a comment…").fill("Automated smoke comment.");
  56  |   await page.getByPlaceholder("Add a comment…").press("Enter");
  57  |   await expect(page.getByText("Automated smoke comment.")).toBeVisible();
  58  | 
  59  |   await page.getByRole("button", { name: /^like$/i }).click();
  60  |   await expect(page.getByRole("button", { name: /liked/i })).toBeVisible();
  61  |   await page.getByRole("button", { name: /^save$/i }).click();
  62  |   await expect(page.getByRole("button", { name: /saved/i })).toBeVisible();
  63  | 
  64  |   // ---- report someone else's track ----
  65  |   await page.goto("/track/t-neon");
  66  |   await page.getByRole("button", { name: /report this track/i }).click();
  67  |   await page.getByPlaceholder(/Name the work you own|Describe the problem/i)
  68  |     .fill("Automated smoke report to verify the moderation queue receives new cases.");
  69  |   await page.getByRole("button", { name: /file report/i }).click();
  70  |   await expect(page.getByText(/report received/i)).toBeVisible();
  71  | 
  72  |   // ---- delete own track, then undo ----
  73  |   await page.goto(trackUrl);
  74  |   await page.getByRole("button", { name: /^delete$/i }).click();
  75  |   await page.getByRole("button", { name: /^delete$/i }).last().click();
  76  |   await expect(page).toHaveURL(/\/($|\?)/);
  77  | 
  78  |   await page.getByRole("button", { name: /^undo$/i }).click();
  79  |   await expect(page.getByRole("link", { name: "Smoke Test Track" }).first()).toBeVisible();
  80  | 
  81  |   await page.goto(trackUrl, { waitUntil: "networkidle" });
> 82  |   await expect(page.getByRole("heading", { level: 1, name: "Smoke Test Track" })).toBeVisible();
      |                                                                                   ^ Error: expect(locator).toBeVisible() failed
  83  | 
  84  |   // ---- moderator: demo account, queue, dismiss, undo ----
  85  |   await context.clearCookies();
  86  |   await page.goto("/login");
  87  |   await page.getByRole("button", { name: /enter the demo studio/i }).click();
  88  |   await expect(page).toHaveURL(/\/($|\?)/);
  89  | 
  90  |   await page.goto("/admin");
  91  |   await expect(page.getByRole("heading", { name: /moderation/i })).toBeVisible();
  92  |   await page.getByRole("button", { name: /everything|^all$/i }).click();
  93  | 
  94  |   const reviewButtons = page.getByRole("button", { name: /^review$/i });
  95  |   await expect(reviewButtons.first()).toBeVisible();
  96  |   await reviewButtons.first().click();
  97  | 
  98  |   await page.getByPlaceholder(/Explain the decision/i).fill("Automated dismissal from the smoke suite.");
  99  |   await page.getByRole("button", { name: /dismiss report/i }).click();
  100 |   await expect(page.getByText(/dismissed/i).first()).toBeVisible();
  101 | 
  102 |   await page.getByRole("button", { name: /^undo$/i }).first().click();
  103 |   await expect(page.getByText(/reverted/i).first()).toBeVisible();
  104 | 
  105 |   // ---- health ----
  106 |   const health = await page.request.get("/api/health");
  107 |   expect(health.ok()).toBeTruthy();
  108 |   const body = await health.json();
  109 |   expect(body.checks.db.mode).toBe("local");
  110 |   expect(body.checks.db.ok).toBe(true);
  111 | });
```