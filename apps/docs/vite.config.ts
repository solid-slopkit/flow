import { fileRoutes } from 'filesystem-routing/vite';
import { defineConfig } from 'vitest/config';
import solid from '@solidjs/vite-plugin';
import { slopkitFromSource } from './slopkit-from-source.ts';

export default defineConfig({
  // GitHub Pages serves the site under /flow/; the deploy workflow sets DOCS_BASE. Dev and tests run at the root.
  base: process.env.DOCS_BASE ?? '/',
  // Turnkey client mode: no index.html and no mount file — the plugin generates
  // the entries around src/App.tsx (wrapped in src/Document.tsx) and `vite build`
  // prerenders the shell into a purely static dist/client.
  plugins: [
    slopkitFromSource(),
    // `extensions` makes @solidjs/vite-plugin also compile the `?pick=` route
    // modules the fileRoutes plugin emits (their ids end in a query string).
    solid({ start: true, ssr: true, extensions: ['.jsx', '.tsx'], diagnostics: true }),
    fileRoutes({ types: true }),
  ],
  server: {
    port: 3000,
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest-setup.ts'],
    passWithNoTests: true,
    // if you have few tests, try commenting this
    // out to improve performance:
    isolate: false,
  },
  build: {
    target: 'esnext',
    assetsInlineLimit: 0,
    rolldownOptions: {
      onwarn(warning, warn) {
        // The Solid plugin appends `export const $$moduleUrl` to every module it compiles for the
        // server, except under node_modules. Here @solid-slopkit/flow is a workspace symlink resolved to
        // packages/flow, so its modules get one each and the `export *` index files re-export several.
        // Consumers install it under node_modules and never see this.
        if (warning.code === 'NAMESPACE_CONFLICT' && warning.message.includes('"$$moduleUrl"')) return;
        warn(warning);
      },
    },
  },
});
