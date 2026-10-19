import { defineConfig } from 'vitest/config';
import solid from '@solidjs/vite-plugin';
import { playwright } from '@vitest/browser-playwright';

// The package ships uncompiled Solid source (see `build:source`); this config only serves the tests.
export default defineConfig({
  plugins: [solid({ ssr: true })],
  test: {
    projects: [
      {
        // Behavior and reactivity: fast, no layout.
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
          exclude: ['**/*.browser.test.*'],
          setupFiles: ['./test/setup.ts'],
        },
      },
      {
        // Anything that needs real layout or real pointer input.
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.{ts,tsx}', 'test/**/*.browser.test.{ts,tsx}'],
          setupFiles: ['./test/setup.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
