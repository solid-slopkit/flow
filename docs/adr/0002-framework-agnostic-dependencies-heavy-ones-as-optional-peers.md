# Framework-agnostic dependencies; heavy ones as optional peers behind subpaths

Several components need a third-party engine (positioning, rich text, carousel), and many of those engines come with React bindings. `@solid-slopkit/components` only depends on framework-agnostic cores and writes the Solid bindings itself. For example, it uses `@floating-ui/dom` rather than `@floating-ui/react`, `@tiptap/core` rather than `@tiptap/react`, and `embla-carousel` rather than `embla-carousel-react`. It never depends on React-ecosystem packages. The same holds for every `@solid-slopkit/*` package: `@solid-slopkit/signal-forms` and `@solid-slopkit/i18n` take only `solid-js` and `@solidjs/web` as peers (plus `vite` for the i18n plugin).

Small, universally needed dependencies like `@floating-ui/dom` are regular dependencies. Heavy libraries that only one feature needs (a rich-text engine, carousel, charts, code highlighting) live behind their own subpath export, such as `@solid-slopkit/components/rich-text`. They are declared as optional peer dependencies, so an app that only renders a `Button` never installs them.

## Consequences

- Every subpath that needs an optional peer must be importable on its own, and the main entry must never import from it.
- Where the usual engine for a feature is React-only, with no agnostic core (e.g. `recharts`), we choose a replacement or write our own.
