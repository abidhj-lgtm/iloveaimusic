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
  - waiting for getByLabel('Artist name')
    - waiting for "http://localhost:3100/signup" navigation to finish...
    - navigated to "http://localhost:3100/signup"

```

# Page snapshot

```yaml
- generic [ref=f1e1]:
  - generic [active]:
    - generic [ref=f1e4]:
      - generic [ref=f1e5]:
        - navigation [ref=f1e7]:
          - button [disabled] [ref=f1e8]:
            - img "previous" [ref=f1e9]
          - generic [ref=f1e11]:
            - generic [ref=f1e12]: 1/
            - text: "2"
          - button [ref=f1e13] [cursor=pointer]:
            - img "next" [ref=f1e14]
        - link "Next.js 15.5.29 (outdated) Webpack" [ref=f1e17] [cursor=pointer]:
          - /url: https://nextjs.org/docs/messages/version-staleness
          - generic "An outdated version detected (latest is 16.4.6), upgrade is highly recommended!" [ref=f1e20]: Next.js 15.5.29 (outdated)
          - generic [ref=f1e21]: Webpack
      - generic [ref=f1e22]:
        - dialog "Console Error" [ref=f1e23]:
          - generic [ref=f1e26]:
            - generic [ref=f1e27]:
              - generic [ref=f1e28]:
                - generic [ref=f1e29]: Console Error
                - generic [ref=f1e31]:
                  - button "Copy Error Info" [ref=f1e32] [cursor=pointer]
                  - link "Go to related documentation" [ref=f1e35] [cursor=pointer]:
                    - /url: https://react.dev/link/rules-of-hooks
                  - link "Learn more about enabling Node.js inspector for server code with Chrome DevTools" [ref=f1e38] [cursor=pointer]:
                    - /url: https://nextjs.org/docs/app/building-your-application/configuring/debugging#server-side-code
              - generic [ref=f1e47]:
                - paragraph [ref=f1e48]: "React has detected a change in the order of Hooks called by StoreProvider. This will lead to bugs and errors if not fixed. For more information, read the Rules of Hooks: https://react.dev/link/rules-of-hooks Previous render Next render ------------------------------------------------------ 1. useState useState 2. useState useState 3. useState useState 4. useState useState 5. useRef useRef 6. useState useState 7. useRef useRef 8. useState useState 9. useCallback useCallback 10. useCallback useCallback 11. useCallback useCallback 12. useCallback useCallback 13. useCallback useCallback 14. useEffect useEffect 15. useEffect useEffect 16. useEffect useEffect 17. undefined useCallback ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^"
                - button "Show More" [ref=f1e50] [cursor=pointer]
            - generic [ref=f1e51]:
              - generic [ref=f1e52]:
                - paragraph [ref=f1e54]:
                  - generic [ref=f1e59]: src\lib\store.tsx (385:43) @ StoreProvider
                  - button "Open in editor" [ref=f1e60] [cursor=pointer]
                - generic [ref=f1e65]:
                  - generic [ref=f1e66]: 383 | const currentUser = s.users.find((u) => u.id === s.sessionUserId) ?? null;
                  - generic [ref=f1e67]: 384 |
                  - generic [ref=f1e68]: "> 385 | const refreshNotifications = useCallback(async () => {"
                  - generic [ref=f1e69]: "| ^"
                  - generic [ref=f1e70]: "386 | if (!currentUser || meta.mode !== \"supabase\") { setNotificationCount(0); return; }"
                  - generic [ref=f1e71]: "387 | try {"
                  - generic [ref=f1e72]: 388 | const res = await api("/api/notifications/unread-count");
              - generic [ref=f1e73]:
                - generic [ref=f1e74]:
                  - paragraph [ref=f1e75]:
                    - text: Call Stack
                    - generic [ref=f1e76]: "20"
                  - button "Show 17 ignore-listed frame(s)" [ref=f1e77] [cursor=pointer]
                - generic [ref=f1e80]:
                  - generic [ref=f1e81]:
                    - text: StoreProvider
                    - button "Open StoreProvider in editor" [ref=f1e82] [cursor=pointer]
                  - text: src\lib\store.tsx (385:43)
                - generic [ref=f1e85]:
                  - generic [ref=f1e86]:
                    - text: Providers
                    - button "Open Providers in editor" [ref=f1e87] [cursor=pointer]
                  - text: src\components\providers.tsx (10:5)
                - generic [ref=f1e90]:
                  - generic [ref=f1e91]:
                    - text: RootLayout
                    - button "Open RootLayout in editor" [ref=f1e92] [cursor=pointer]
                  - text: src\app\layout.tsx (61:9)
          - generic [ref=f1e95]:
            - generic [ref=f1e96]: "1"
            - generic [ref=f1e97]: "2"
        - contentinfo [ref=f1e98]:
          - region "Error feedback" [ref=f1e99]:
            - paragraph [ref=f1e100]:
              - link "Was this helpful?" [ref=f1e101] [cursor=pointer]:
                - /url: https://nextjs.org/telemetry#error-feedback
            - button "Mark as helpful" [ref=f1e102] [cursor=pointer]
            - button "Mark as not helpful" [ref=f1e106] [cursor=pointer]
    - generic [ref=f1e113] [cursor=pointer]:
      - button "Open Next.js Dev Tools" [ref=f1e114]
      - generic [ref=f1e118]:
        - button "Open issues overlay" [ref=f1e119]:
          - generic [ref=f1e120]:
            - generic [aria-hidden] [ref=f1e121]: "1"
            - generic [ref=f1e122]: "2"
          - generic [ref=f1e123]:
            - text: Issue
            - generic [aria-hidden] [ref=f1e124]: s
        - button "Collapse issues badge" [ref=f1e125]
  - 'heading "Application error: a client-side exception has occurred while loading localhost (see the browser console for more information)." [level=2] [ref=f1e130]'
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
> 16  |   await page.getByLabel("Artist name").fill("Smoke Tester");
      |                                        ^ Error: locator.fill: Test timeout of 90000ms exceeded.
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