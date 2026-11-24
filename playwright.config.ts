import { defineConfig } from "@playwright/test";
import path from "node:path";

const PORT = 3100;
const DATA_DIR = path.join(process.cwd(), ".data-e2e");

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off"
  },
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      // Force local mode so the dev inbox works and no external service is touched.
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      RESEND_API_KEY: "",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      SENTRY_DSN: "",
      ALLOW_DEMO_LOGIN: "true",
      STAFF_EMAILS: "",
      ILISTENAI_DATA_DIR: DATA_DIR,
      NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${PORT}`,
      NODE_ENV: "development"
    }
  }
});