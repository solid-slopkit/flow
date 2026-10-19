import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const librarySource = fileURLToPath(new URL('../../packages/flow/src/index.ts', import.meta.url));
const stylesSource = fileURLToPath(new URL('../../packages/flow/src/styles/', import.meta.url));

// In dev, @solid-slopkit/flow and its stylesheets resolve to the package source, so edits show up without a build.
// @solid-slopkit/components comes from npm like in any app.
export function slopkitFromSource(): Plugin {
  return {
    name: 'slopkit-from-source',
    apply: 'serve',
    enforce: 'pre',
    resolveId(id) {
      if (id === '@solid-slopkit/flow') return librarySource;
      if (id.startsWith('@solid-slopkit/flow/styles/')) return stylesSource + id.slice('@solid-slopkit/flow/styles/'.length);
    },
  };
}
