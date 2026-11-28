import { defineConfig, devices } from "@playwright/test";

/** Test de humo de extremo a extremo. Requiere `npm run build` antes (lo arranca con `next start`). */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://localhost:3100", trace: "off" },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
    { name: "movil", use: { ...devices["Pixel 7"] } },
  ],
  webServer: { command: "npx next start -p 3100", url: "http://localhost:3100", reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
