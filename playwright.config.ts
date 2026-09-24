import { defineConfig } from '@playwright/test';

// Local acceptance servers must not go through the host's external HTTP proxy.
process.env.NO_PROXY = [process.env.NO_PROXY, 'localhost', '127.0.0.1', '::1'].filter(Boolean).join(',');
process.env.no_proxy = process.env.NO_PROXY;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: { headless: true, launchOptions: { args: ['--no-proxy-server'] }, viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, trace: 'retain-on-failure' },
  projects: [
    { name: 'chrome-dev', use: { channel: 'chrome', baseURL: 'http://127.0.0.1:5173' } },
    { name: 'edge-preview', use: { channel: 'msedge', baseURL: 'http://127.0.0.1:4173' } },
  ],
  webServer: [
    { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
    { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
  ],
});
