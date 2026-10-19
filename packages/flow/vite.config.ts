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
          exclude: ['**/*.browser.test.*', '**/*.server.test.*'],
          setupFiles: ['./test/setup.ts'],
        },
      },
      {
        // Rendering on the server (ADR 0019): Solid's server build, no DOM.
        extends: true,
        resolve: { conditions: ['node', 'development'] },
        ssr: { resolve: { conditions: ['node', 'development'], externalConditions: ['node', 'development'] } },
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/**/*.server.test.{ts,tsx}', 'test/**/*.server.test.{ts,tsx}'],
        },
      },
      {
        // Anything that needs real layout or real pointer input.
        extends: true,
        test: {
          name: 'browser',
          // After the jsdom and server projects, not beside them: its captures keep the compute-time check
          // (HOT_SCOPE_TIME), which the jsdom workers' CPU load would otherwise trip at random.
          sequence: { groupOrder: 1 },
          include: ['src/**/*.browser.test.{ts,tsx}', 'test/**/*.browser.test.{ts,tsx}'],
          setupFiles: ['./test/setup.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            // Room for a whole test Flow: real input only reaches what is on screen.
            viewport: { width: 1280, height: 800 },
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
