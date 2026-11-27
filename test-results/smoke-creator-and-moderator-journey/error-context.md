# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> creator and moderator journey
- Location: tests\smoke.spec.ts:13:1

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: locator.click: Test timeout of 90000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /^like$/i })

```

# Page snapshot

```yaml
- generic [ref=f1e1]:
  - banner [ref=f1e2]:
    - generic [ref=f1e3]:
      - link "I Love AI Music — home" [ref=f1e4] [cursor=pointer]:
        - /url: /
        - generic [ref=f1e12]:
          - text: I Love
          - emphasis [ref=f1e13]: AI Music
      - navigation "Primary" [ref=f1e14]:
        - link "Feed" [ref=f1e15] [cursor=pointer]:
          - /url: /
        - link "Post music" [ref=f1e19] [cursor=pointer]:
          - /url: /create
      - generic [ref=f1e21]:
        - button "Mute all sound" [ref=f1e22] [cursor=pointer]
        - link "Post music" [ref=f1e27] [cursor=pointer]:
          - /url: /create
        - button "Notifications" [ref=f1e32] [cursor=pointer]
        - button "More options" [ref=f1e37] [cursor=pointer]:
          - img "Smoke Tester" [ref=f1e38]
  - complementary "Sidebar" [ref=f1e39]:
    - navigation [ref=f1e40]:
      - link "Home" [ref=f1e41] [cursor=pointer]:
        - /url: /
      - link "Explore" [ref=f1e46] [cursor=pointer]:
        - /url: /?focus=search
      - link "Create" [ref=f1e51] [cursor=pointer]:
        - /url: /create
      - link "Saved" [ref=f1e54] [cursor=pointer]:
        - /url: /?view=saved
      - link "Profile" [ref=f1e58] [cursor=pointer]:
        - /url: /profile/smoketester
    - link "Post music" [ref=f1e63] [cursor=pointer]:
      - /url: /create
    - link [ref=f1e68] [cursor=pointer]:
      - /url: /profile/smoketester
      - img "Smoke Tester" [ref=f1e69]
      - generic [ref=f1e70]:
        - strong [ref=f1e71]: Smoke Tester
        - emphasis [ref=f1e72]: "@smoketester"
    - generic [ref=f1e73]:
      - generic [ref=f1e74]: 8 tracks · 6 artists
      - generic [ref=f1e75]: I Listen AI Music © 2026
  - main [ref=f1e76]:
    - generic [ref=f1e77]:
      - navigation "Breadcrumb" [ref=f1e78]:
        - link "Feed" [ref=f1e79] [cursor=pointer]:
          - /url: /
        - generic [aria-hidden] [ref=f1e82]: /
        - link "Discover" [ref=f1e83] [cursor=pointer]:
          - /url: /discover
        - generic [aria-hidden] [ref=f1e84]: /
        - link "Smoke Tester" [ref=f1e85] [cursor=pointer]:
          - /url: /profile/smoketester
        - generic [aria-hidden] [ref=f1e86]: /
        - generic [ref=f1e87]: Smoke Test Track
      - article [ref=f1e88]:
        - generic [ref=f1e89]:
          - img "Cover art for Smoke Test Track" [ref=f1e90]
          - button "Play" [ref=f1e91] [cursor=pointer]
        - generic [ref=f1e94]:
          - generic [ref=f1e95]:
            - generic [ref=f1e96]: YouTube
            - generic [ref=f1e97]: Vocal
          - heading "Smoke Test Track" [level=1] [ref=f1e98]
          - link [ref=f1e100] [cursor=pointer]:
            - /url: /profile/smoketester
            - img "Smoke Tester" [ref=f1e102]
            - generic [ref=f1e103]:
              - strong [ref=f1e104]: Smoke Tester
              - emphasis [ref=f1e105]:
                - text: "@smoketester ·"
                - time [ref=f1e106]: November 27, 2026
          - paragraph [ref=f1e107]: A smoke test track created by the automated suite to verify the publishing path end to end..
          - generic [ref=f1e108]:
            - generic "1 plays" [ref=f1e109]:
              - strong [ref=f1e115]: "1"
              - text: plays
            - generic "0 loves" [ref=f1e116]:
              - strong [ref=f1e119]: "0"
              - text: loves
            - generic "0 comments" [ref=f1e120]:
              - strong [ref=f1e123]: "0"
              - text: comments
          - generic [ref=f1e124]:
            - button "Play track" [ref=f1e125] [cursor=pointer]
            - button "Love this track — 0 loves" [ref=f1e129] [cursor=pointer]:
              - generic [ref=f1e133]: Like
              - emphasis [ref=f1e134]: "0"
            - button "Save this track" [ref=f1e135] [cursor=pointer]:
              - generic [ref=f1e139]: Save
            - button "Share" [ref=f1e140] [cursor=pointer]
            - link "Edit" [ref=f1e148] [cursor=pointer]:
              - /url: /create?edit=107e80d2-8cc8-454e-b217-acba007e0e84
            - button "Delete" [ref=f1e153] [cursor=pointer]
          - generic [ref=f1e158]:
            - generic [ref=f1e159]:
              - strong [ref=f1e162]: "1"
              - text: plays
            - generic [ref=f1e163]:
              - strong [ref=f1e166]: "0"
              - text: likes
            - generic [ref=f1e167]:
              - strong [ref=f1e170]: "0"
              - text: comments
          - generic [ref=f1e171]:
            - generic [ref=f1e172]:
              - term [ref=f1e173]: Artist
              - definition [ref=f1e174]:
                - link "Smoke Tester" [ref=f1e175] [cursor=pointer]:
                  - /url: /profile/smoketester
            - generic [ref=f1e176]:
              - term [ref=f1e177]: Published
              - definition [ref=f1e178]:
                - time [ref=f1e179]: November 27, 2026
            - generic [ref=f1e180]:
              - term [ref=f1e181]: Source
              - definition [ref=f1e182]: YouTube embed
            - generic [ref=f1e183]:
              - term [ref=f1e184]: Plays
              - definition [ref=f1e185]: "0"
            - generic [ref=f1e186]:
              - term [ref=f1e187]: Likes
              - definition [ref=f1e188]: "0"
            - generic [ref=f1e189]:
              - term [ref=f1e190]: Lyrics
              - definition [ref=f1e191]: Full lyrics published
      - generic [ref=f1e192]:
        - heading "Watch on YouTube" [level=2] [ref=f1e193]
        - iframe [ref=f1e198]:
          - generic [ref=f4e1]:
            - generic "YouTube Video Player" [ref=f4e3]
            - dialog "Video unavailable" [ref=f4e6]:
              - generic [ref=f4e9]:
                - img "YouTube Logo" [ref=f4e10]
                - generic [ref=f4e11]: Video unavailable
                - generic [ref=f4e12]: This live stream recording is not available.
      - generic [ref=f1e199]:
        - heading "Rights & provenance" [level=2] [ref=f1e200]
        - generic [ref=f1e204]:
          - generic [ref=f1e205]:
            - generic [ref=f1e206]:
              - heading "Rights & provenance" [level=3] [ref=f1e207]
              - paragraph [ref=f1e211]: Complete this so listeners know what they are hearing — and so moderators can defend your post.
            - button "Complete now" [ref=f1e212] [cursor=pointer]
          - generic [ref=f1e213]:
            - generic [ref=f1e214]: Provenance missing
            - generic [ref=f1e217]: All rights reserved
            - generic [ref=f1e222]: Safe
      - generic [ref=f1e223]:
        - heading "Style / Prompt" [level=2] [ref=f1e224]
        - generic [ref=f1e228]:
          - paragraph [ref=f1e229]: smoke test, automated, verification
          - button "Copy prompt" [ref=f1e230] [cursor=pointer]
        - generic [ref=f1e235]:
          - link "smoke test" [ref=f1e236] [cursor=pointer]:
            - /url: /discover?tag=smoke%20test
          - link "automated" [ref=f1e237] [cursor=pointer]:
            - /url: /discover?tag=automated
          - link "verification" [ref=f1e238] [cursor=pointer]:
            - /url: /discover?tag=verification
      - generic [ref=f1e239]:
        - heading "Background — the story behind Smoke Test Track" [level=2] [ref=f1e240]
        - paragraph [ref=f1e243]: A smoke test track created by the automated suite to verify the publishing path end to end.
      - generic [ref=f1e244]:
        - heading "Lyrics" [level=2] [ref=f1e245]
        - generic [ref=f1e255]:
          - strong [ref=f1e256]: Instrumental
          - paragraph [ref=f1e257]: No lyrics — let the frequencies do the talking.
      - generic [ref=f1e258]:
        - heading "Comments · 0" [level=2] [ref=f1e259]
        - generic [ref=f1e263]:
          - paragraph [ref=f1e268]: No comments yet. Say something kind — or something clever.
          - generic [ref=f1e269]:
            - img "Smoke Tester" [ref=f1e270]
            - textbox "Add a comment" [active] [ref=f1e271]:
              - /placeholder: Add a comment…
            - button "Send comment" [disabled] [ref=f1e272]
      - generic [ref=f1e276]:
        - heading "About this track" [level=2] [ref=f1e277]
        - paragraph [ref=f1e278]:
          - strong [ref=f1e279]: Smoke Test Track
          - text: is an AI-assisted vocal track published by
          - link "Smoke Tester" [ref=f1e280] [cursor=pointer]:
            - /url: /profile/smoketester
          - text: on I Love AI Music. The provenance panel above records the licence, the AI tool used and the creator's human contribution. The style prompt is copyable so other producers can study the wording and hear how small changes move the result.
        - paragraph [ref=f1e281]:
          - link "Browse the catalog" [ref=f1e282] [cursor=pointer]:
            - /url: /discover
          - text: ·
          - link "Copyright & takedown policy" [ref=f1e283] [cursor=pointer]:
            - /url: /legal/dmca
          - text: ·
          - link "Post your own track" [ref=f1e284] [cursor=pointer]:
            - /url: /create
  - generic "Music player" [ref=f1e285]:
    - slider "Seek" [ref=f1e286] [cursor=pointer]: "0"
    - generic [ref=f1e287]:
      - generic [ref=f1e288]:
        - iframe [ref=f1e290]:
          - generic [ref=f6e1]:
            - generic "YouTube Video Player" [ref=f6e3]
            - dialog "Video unavailable" [ref=f6e6]:
              - generic [ref=f6e9]:
                - img "YouTube Logo" [ref=f6e10]
                - generic [ref=f6e11]: Video unavailable
                - generic [ref=f6e12]: This live stream recording is not available.
        - link "Smoke Test Track Smoke Tester" [ref=f1e291] [cursor=pointer]:
          - /url: /track/107e80d2-8cc8-454e-b217-acba007e0e84
          - generic [ref=f1e292]: Smoke Test Track
          - generic [ref=f1e293]: Smoke Tester
      - generic [ref=f1e294]:
        - button "Previous track" [ref=f1e295] [cursor=pointer]
        - button "Play" [ref=f1e298] [cursor=pointer]
        - button "Next track" [ref=f1e301] [cursor=pointer]
        - button "Repeat one off" [ref=f1e304] [cursor=pointer]
      - generic [ref=f1e310]:
        - generic [ref=f1e311]: "--:--"
        - slider "Seek" [ref=f1e312] [cursor=pointer]: "0"
        - generic [ref=f1e313]: "--:--"
      - generic [ref=f1e314]:
        - button "Mute" [ref=f1e315] [cursor=pointer]
        - slider "Volume" [ref=f1e320] [cursor=pointer]: "85"
        - link "Open track page" [ref=f1e321] [cursor=pointer]:
          - /url: /track/107e80d2-8cc8-454e-b217-acba007e0e84
  - status
  - button "Open Next.js Dev Tools" [ref=f1e330] [cursor=pointer]
  - alert [ref=f1e334]: Smoke Test Track — Smoke Tester · I Love AI Music
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
> 59  |   await page.getByRole("button", { name: /^like$/i }).click();
      |                                                       ^ Error: locator.click: Test timeout of 90000ms exceeded.
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
  82  |   await expect(page.getByRole("heading", { level: 1, name: "Smoke Test Track" })).toBeVisible();
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