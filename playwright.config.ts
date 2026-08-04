import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  timeout: 15000,
  reporter: 'html',

  projects: [
    // Setup : génère le storageState (localStorage) avec le token coach
    {
      name: 'setup',
      testMatch: '**/setup.ts',
    },
    {
      name: 'iPhone SE',
      use: {
        ...devices['iPhone SE'],
        storageState: 'e2e/auth-coach.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'iPhone 14',
      use: {
        ...devices['iPhone 14'],
        storageState: 'e2e/auth-coach.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'node server.js',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 15000,
  },
});
