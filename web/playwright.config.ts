import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a mocked Jellyfin (see e2e/mock-jellyfin.ts),
 * so they need no server and never touch real data.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    { name: "phone", use: { ...devices["Pixel 7"] } },
    {
      // Plain HTTP on a real host name is not a secure context (127.0.0.1 is),
      // so APIs like crypto.randomUUID and navigator.clipboard are missing,
      // as in the HTTP deployment.
      name: "plain-http",
      testMatch: ["http.spec.ts", "auth.spec.ts", "browse.spec.ts", "play.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://finora.test:4173",
        launchOptions: { args: ["--host-resolver-rules=MAP finora.test 127.0.0.1"] },
      },
    },
  ],
  webServer: {
    command: "pnpm exec vite --port 4173 --strictPort --host 127.0.0.1",
    env: { __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: "finora.test" },
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
