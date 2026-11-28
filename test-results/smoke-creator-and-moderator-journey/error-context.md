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
Error: locator.fill: Test timeout of 90000ms exceeded.
Call log:
  - waiting for getByPlaceholder('Add a comment…')

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
        - link "Search" [ref=f1e21] [cursor=pointer]:
          - /url: /search
      - generic [ref=f1e25]:
        - button "Mute all sound" [ref=f1e26] [cursor=pointer]
        - link "Post music" [ref=f1e31] [cursor=pointer]:
          - /url: /create
        - button "More options" [ref=f1e36] [cursor=pointer]:
          - img "Smoke Tester" [ref=f1e37]
  - complementary "Sidebar" [ref=f1e38]:
    - navigation [ref=f1e39]:
      - link "Home" [ref=f1e40] [cursor=pointer]:
        - /url: /
      - link "Explore" [ref=f1e45] [cursor=pointer]:
        - /url: /?focus=search
      - link "Create" [ref=f1e50] [cursor=pointer]:
        - /url: /create
      - link "Saved" [ref=f1e53] [cursor=pointer]:
        - /url: /?view=saved
      - link "Profile" [ref=f1e57] [cursor=pointer]:
        - /url: /profile/smoketester
    - link "Post music" [ref=f1e62] [cursor=pointer]:
      - /url: /create
    - link [ref=f1e67] [cursor=pointer]:
      - /url: /profile/smoketester
      - img "Smoke Tester" [ref=f1e68]
      - generic [ref=f1e69]:
        - strong [ref=f1e70]: Smoke Tester
        - emphasis [ref=f1e71]: "@smoketester"
    - generic [ref=f1e72]:
      - generic [ref=f1e73]: 8 tracks · 6 artists
      - generic [ref=f1e74]: I Love AI Music © 2026
  - main [ref=f1e75]:
    - generic [ref=f1e76]:
      - navigation "Breadcrumb" [ref=f1e77]:
        - link "Feed" [ref=f1e78] [cursor=pointer]:
          - /url: /
        - generic [aria-hidden] [ref=f1e81]: /
        - link "Discover" [ref=f1e82] [cursor=pointer]:
          - /url: /discover
        - generic [aria-hidden] [ref=f1e83]: /
        - link "Smoke Tester" [ref=f1e84] [cursor=pointer]:
          - /url: /profile/smoketester
        - generic [aria-hidden] [ref=f1e85]: /
        - generic [ref=f1e86]: Smoke Test Track
      - article [ref=f1e87]:
        - generic [ref=f1e88]:
          - img "Cover art for Smoke Test Track" [ref=f1e89]
          - button "Play" [ref=f1e90] [cursor=pointer]
        - generic [ref=f1e93]:
          - generic [ref=f1e94]:
            - generic [ref=f1e95]: YouTube
            - generic [ref=f1e96]: Vocal
          - heading "Smoke Test Track" [level=1] [ref=f1e97]
          - link [ref=f1e99] [cursor=pointer]:
            - /url: /profile/smoketester
            - img "Smoke Tester" [ref=f1e101]
            - generic [ref=f1e102]:
              - strong [ref=f1e103]: Smoke Tester
              - emphasis [ref=f1e104]:
                - text: "@smoketester ·"
                - time [ref=f1e105]: November 28, 2026
          - paragraph [ref=f1e106]: A smoke test track created by the automated suite to verify the publishing path end to end..
          - generic [ref=f1e107]:
            - generic "1 plays" [ref=f1e108]:
              - strong [ref=f1e114]: "1"
              - text: plays
            - generic "0 loves" [ref=f1e115]:
              - strong [ref=f1e118]: "0"
              - text: loves
            - generic "0 comments" [ref=f1e119]:
              - strong [ref=f1e122]: "0"
              - text: comments
          - generic [ref=f1e123]:
            - button "Play track" [active] [ref=f1e124] [cursor=pointer]
            - button "Like" [ref=f1e128] [cursor=pointer]
            - button "Save" [ref=f1e133] [cursor=pointer]
            - button "Share" [ref=f1e138] [cursor=pointer]
            - button "Add to playlist" [ref=f1e146] [cursor=pointer]:
              - generic [ref=f1e149]: Playlist
            - link "Edit" [ref=f1e150] [cursor=pointer]:
              - /url: /create?edit=c37b515c-375b-467a-803d-f426a851175b
            - button "Delete" [ref=f1e155] [cursor=pointer]
          - generic [ref=f1e160]:
            - generic [ref=f1e161]:
              - strong [ref=f1e164]: "1"
              - text: plays
            - generic [ref=f1e165]:
              - strong [ref=f1e168]: "0"
              - text: likes
            - generic [ref=f1e169]:
              - strong [ref=f1e172]: "0"
              - text: comments
          - generic [ref=f1e173]:
            - generic [ref=f1e174]:
              - term [ref=f1e175]: Artist
              - definition [ref=f1e176]:
                - link "Smoke Tester" [ref=f1e177] [cursor=pointer]:
                  - /url: /profile/smoketester
            - generic [ref=f1e178]:
              - term [ref=f1e179]: Published
              - definition [ref=f1e180]:
                - time [ref=f1e181]: November 28, 2026
            - generic [ref=f1e182]:
              - term [ref=f1e183]: Source
              - definition [ref=f1e184]: YouTube embed
            - generic [ref=f1e185]:
              - term [ref=f1e186]: Plays
              - definition [ref=f1e187]: "0"
            - generic [ref=f1e188]:
              - term [ref=f1e189]: Likes
              - definition [ref=f1e190]: "0"
            - generic [ref=f1e191]:
              - term [ref=f1e192]: Lyrics
              - definition [ref=f1e193]: Full lyrics published
      - generic [ref=f1e194]:
        - heading "Watch on YouTube" [level=2] [ref=f1e195]
        - iframe [ref=f1e200]:
          - generic [ref=f4e1]:
            - generic "YouTube Video Player" [ref=f4e3]
            - dialog "Video unavailable" [ref=f4e6]:
              - generic [ref=f4e9]:
                - img "YouTube Logo" [ref=f4e10]
                - generic [ref=f4e11]: Video unavailable
                - generic [ref=f4e12]: This live stream recording is not available.
      - generic [ref=f1e201]:
        - heading "Rights & provenance" [level=2] [ref=f1e202]
        - generic [ref=f1e206]:
          - generic [ref=f1e207]:
            - generic [ref=f1e208]:
              - heading "Rights & provenance" [level=3] [ref=f1e209]
              - paragraph [ref=f1e213]: Complete this so listeners know what they are hearing — and so moderators can defend your post.
            - button "Complete now" [ref=f1e214] [cursor=pointer]
          - generic [ref=f1e215]:
            - generic [ref=f1e216]: Provenance missing
            - generic [ref=f1e219]: All rights reserved
            - generic [ref=f1e224]: Safe
      - generic [ref=f1e225]:
        - heading "Style / Prompt" [level=2] [ref=f1e226]
        - generic [ref=f1e230]:
          - paragraph [ref=f1e231]: smoke test, automated, verification
          - button "Copy prompt" [ref=f1e232] [cursor=pointer]
        - generic [ref=f1e237]:
          - link "smoke test" [ref=f1e238] [cursor=pointer]:
            - /url: /discover?tag=smoke%20test
          - link "automated" [ref=f1e239] [cursor=pointer]:
            - /url: /discover?tag=automated
          - link "verification" [ref=f1e240] [cursor=pointer]:
            - /url: /discover?tag=verification
      - generic [ref=f1e241]:
        - heading "Background — the story behind Smoke Test Track" [level=2] [ref=f1e242]
        - paragraph [ref=f1e245]: A smoke test track created by the automated suite to verify the publishing path end to end.
      - generic [ref=f1e246]:
        - heading "Lyrics" [level=2] [ref=f1e247]
        - generic [ref=f1e257]:
          - strong [ref=f1e258]: Instrumental
          - paragraph [ref=f1e259]: No lyrics — let the frequencies do the talking.
      - generic [ref=f1e260]:
        - heading "Comments · 0" [level=2] [ref=f1e261]
        - generic [ref=f1e265]:
          - paragraph [ref=f1e270]: No comments yet. Say something kind — or something clever.
          - generic [ref=f1e271]:
            - img "Smoke Tester" [ref=f1e272]
            - generic [ref=f1e274]:
              - textbox "Add a comment" [ref=f1e275]:
                - /placeholder: Write a comment…
              - button "Insert emoji" [ref=f1e276] [cursor=pointer]
      - generic [ref=f1e280]:
        - heading "About this track" [level=2] [ref=f1e281]
        - paragraph [ref=f1e282]:
          - strong [ref=f1e283]: Smoke Test Track
          - text: is an AI-assisted vocal track published by
          - link "Smoke Tester" [ref=f1e284] [cursor=pointer]:
            - /url: /profile/smoketester
          - text: on I Love AI Music. The provenance panel above records the licence, the AI tool used and the creator's human contribution. The style prompt is copyable so other producers can study the wording and hear how small changes move the result.
        - paragraph [ref=f1e285]:
          - link "Browse the catalog" [ref=f1e286] [cursor=pointer]:
            - /url: /discover
          - text: ·
          - link "Copyright & takedown policy" [ref=f1e287] [cursor=pointer]:
            - /url: /legal/dmca
          - text: ·
          - link "Post your own track" [ref=f1e288] [cursor=pointer]:
            - /url: /create
  - generic "Music player" [ref=f1e289]:
    - slider "Seek" [ref=f1e290] [cursor=pointer]: "0"
    - generic [ref=f1e291]:
      - generic [ref=f1e292]:
        - iframe [ref=f1e294]:
          - generic [ref=f6e1]:
            - generic "YouTube Video Player" [ref=f6e3]
            - dialog "Video unavailable" [ref=f6e6]:
              - generic [ref=f6e9]:
                - img "YouTube Logo" [ref=f6e10]
                - generic [ref=f6e11]: Video unavailable
                - generic [ref=f6e12]: This live stream recording is not available.
        - link "Smoke Test Track Smoke Tester" [ref=f1e295] [cursor=pointer]:
          - /url: /track/c37b515c-375b-467a-803d-f426a851175b
          - generic [ref=f1e296]: Smoke Test Track
          - generic [ref=f1e297]: Smoke Tester
      - generic [ref=f1e298]:
        - button "Previous track" [ref=f1e299] [cursor=pointer]
        - button "Play" [ref=f1e302] [cursor=pointer]
        - button "Next track" [ref=f1e305] [cursor=pointer]
        - button "Repeat one off" [ref=f1e308] [cursor=pointer]
      - generic [ref=f1e314]:
        - generic [ref=f1e315]: "--:--"
        - slider "Seek" [ref=f1e316] [cursor=pointer]: "0"
        - generic [ref=f1e317]: "--:--"
      - generic [ref=f1e318]:
        - button "Mute" [ref=f1e319] [cursor=pointer]
        - slider "Volume" [ref=f1e324] [cursor=pointer]: "85"
        - link "Open track page" [ref=f1e325] [cursor=pointer]:
          - /url: /track/c37b515c-375b-467a-803d-f426a851175b
  - status
  - button "Open Next.js Dev Tools" [ref=f1e334] [cursor=pointer]
  - alert [ref=f1e338]: Smoke Test Track — Smoke Tester · I Love AI Music
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
> 55  |   await page.getByPlaceholder("Add a comment…").fill("Automated smoke comment.");
      |                                                 ^ Error: locator.fill: Test timeout of 90000ms exceeded.
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