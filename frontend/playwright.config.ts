import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // PLAYWRIGHT_CHANNEL=chrome uses the installed Google Chrome instead of Playwright's own download.
  use: { baseURL: "http://localhost:3000", channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  webServer: { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true },
  projects: [
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
});
