import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// Tests run in real browsers (Chromium, WebKit = Safari's engine, Firefox), because the library
// animates with the browser's own Web Animations. Time is still stepped by hand: see test/clock.ts.
export default defineConfig({
  test: {
    setupFiles: ['test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      screenshotFailures: false,
      instances: [{ browser: 'chromium' }, { browser: 'webkit' }, { browser: 'firefox' }],
    },
  },
});
