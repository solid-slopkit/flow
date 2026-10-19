# Browser baseline: evergreen browsers from 2024 onward

We support Chrome/Edge 123+, Safari 17.5+ and Firefox 125+. Within that range, components use the platform directly, without fallbacks: `@layer`, `color-mix()`, `light-dark()`, CSS nesting, `:has()`, `inert`, the Popover API and `<dialog>`. Our theming model (ADR 0005) already needs `light-dark()`, which sets the floor for Chrome and Safari; Firefox's is the Popover API, which it shipped in 125 (`:has()` came in 121). Supporting older browsers would mean JS fallbacks for the very features the design is built on.

Features newer than the baseline, such as CSS anchor positioning, may only be used as progressive enhancement with a working fallback.
