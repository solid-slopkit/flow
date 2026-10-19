// The site's base path without its trailing slash: empty in dev, `/flow` on GitHub Pages (DOCS_BASE, see
// vite.config.ts). The router only handles anchors whose href is under its base, so every internal link goes through
// `withBase`. `navigate()` adds the base itself and takes the bare path.
export const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** A docs path (`/animation`) as an href under the site's base. */
export const withBase = (path: string) => base + path;

/**
 * Whether the location's pathname is the docs path `path`. GitHub Pages serves each page as a folder's index.html
 * and redirects `/flow/animation` to `/flow/animation/`, so a trailing slash doesn't count.
 */
export const isPath = (pathname: string, path: string) => pathname.replace(/\/$/, '') === withBase(path).replace(/\/$/, '');
