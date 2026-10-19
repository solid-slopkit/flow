## slopkit docs

Documentation site for `@solid-slopkit/flow`: header + sidebar + main content, built with SolidJS 2, `@solidjs/router` file-system routes and `vite`.

```bash
pnpm dev
```

In dev, `@solid-slopkit/flow` resolves to the package source (`slopkit-from-source.ts`), so edits to it show up immediately. `@solid-slopkit/components`, which renders the docs and the examples' inputs, comes from npm.

## GitHub Pages

The site is published at https://solid-slopkit.github.io/flow/ by `.github/workflows/docs.yml` on every push to `main`. The workflow builds with `DOCS_BASE=/flow/` (Vite's `base`), then `pnpm prerender` (`prerender.js`) renders every route file through the built SSR handler into `dist/client/<path>/index.html`, plus `404.html`. The pages hydrate as they do under `server.js`. To check a Pages build locally, build the package first, then:

```bash
DOCS_BASE=/flow/ pnpm build && DOCS_BASE=/flow/ pnpm prerender
```

Because the site lives under a base path, internal links go through `withBase()` from `src/base.ts`: `<a href={withBase('/animation')}>`. The router only handles anchors under its base, so a bare `href="/animation"` works in dev and breaks on Pages. `navigate()` adds the base itself. Compare the current location to a docs path with `isPath()`, which ignores the trailing slash Pages adds.

## Structure

- `src/routes/` — pages. `animation.tsx` is `/animation`; `[...404].tsx` catches everything else. `prerender.js` builds one static page per route file.
- `src/nav.ts` — the sidebar. Add an entry when you add a page.
- `src/layout/` — the shell: header, sidebar (a drawer below 768px) and main area.
- `src/components/` — doc building blocks:
  - `Example` renders a live example above its source.
  - `CodeBlock` highlights with shiki, lazy-loaded with only tsx, css and bash.
  - `PropsTable` / `CssVarsTable` render API tables.
  - `H2` is a linkable section heading.
- `src/examples/` — one file per example. Pages import each twice: the default export to render it, and `?raw` to show its source, so the code shown is always the code that runs.

The docs chrome in `src/App.css` only uses the slopkit theme tokens.
