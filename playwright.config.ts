import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

const managedChrome = '/opt/hermes-browsers/156.0.8078.80/chrome-linux64/chrome'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
    launchOptions: {
      executablePath: existsSync(managedChrome) ? managedChrome : undefined,
      chromiumSandbox: true
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
