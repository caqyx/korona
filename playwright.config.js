import { defineConfig } from '@playwright/test';

const PORT = 4173;
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || `http://localhost:${PORT}`,
    trace: 'off',
    launchOptions: { args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `npm run build && npx vite preview --port ${PORT} --strictPort`, port: PORT, reuseExistingServer: true, timeout: 120_000 },
});
