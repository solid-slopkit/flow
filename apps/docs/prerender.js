// Turns the SSR build into a static site for GitHub Pages: renders every route through the built server bundle's
// `handleRequest` and writes each page to dist/client/<path>/index.html, plus 404.html for unknown paths. Run after
// `vite build`, with the same DOCS_BASE. Every page hydrates like a server-rendered one, so the site behaves as it
// does under server.js.
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleRequest } from './dist/server/server.js';

const root = dirname(fileURLToPath(import.meta.url));
const routesDir = join(root, 'src/routes');
const outDir = join(root, 'dist/client');
const base = (process.env.DOCS_BASE ?? '/').replace(/\/$/, '');

/** The URL path of every page route file: `index.tsx` is `/`, `animation.tsx` is `/animation`. */
function routePaths(dir = routesDir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) return routePaths(file);
    // `[...404].tsx` is the catch-all; it becomes 404.html below.
    if (!entry.name.endsWith('.tsx') || entry.name.startsWith('[')) return [];
    const path = relative(routesDir, file)
      .replace(/\.tsx$/, '')
      .replace(/(^|\/)index$/, '');
    return [`/${path}`];
  });
}

/** Renders `path` to a complete document: 'async' waits for every boundary instead of streaming fallbacks. */
async function render(path) {
  const response = await handleRequest(new Request(`http://localhost${base}${path}`), { renderMode: 'async' });
  return { status: response.status, html: await response.text() };
}

function write(file, html) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

let failed = false;
for (const path of routePaths().sort()) {
  const { status, html } = await render(path);
  if (status !== 200) {
    console.error(`${path}: expected 200, got ${status}`);
    failed = true;
    continue;
  }
  write(join(outDir, path, 'index.html'), html);
  console.log(`${base}${path}`);
}

// GitHub Pages serves 404.html, with a 404 status, for any path it has no file for.
const notFound = await render('/__not-found__');
if (notFound.status !== 404) {
  console.error(`The catch-all route answered ${notFound.status}, expected 404`);
  failed = true;
}
write(join(outDir, '404.html'), notFound.html);

if (failed) process.exit(1);
