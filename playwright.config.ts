import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [
    [process.env.CI ? "github" : "list"],
    ["./tests/e2e/completion-reporter.mjs"],
  ],
  use: {
    baseURL: process.env.RAVA_E2E_BASE_URL ?? "http://127.0.0.1:3210",
    locale: "fa-IR",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 },
        ...(process.env.CI ? {} : { channel: "msedge" }),
      },
    },
  ],
});
