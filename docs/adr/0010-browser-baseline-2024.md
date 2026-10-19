# Browser baseline: evergreen browsers from 2024 onward

We support Chrome/Edge 123+, Safari 17.5+ and Firefox 125+. Within that range, the package uses the platform directly, without fallbacks: `@layer`, `color-mix()`, `light-dark()`, CSS nesting, `:has()`, `inert`, the Popover API and `<dialog>`. `light-dark()` sets the floor for Chrome and Safari; Firefox's is the Popover API, which it shipped in 125 (`:has()` came in 121). Supporting older browsers would mean JS fallbacks for features these browsers already have.

Features newer than the baseline, such as CSS anchor positioning, may only be used as progressive enhancement with a working fallback.
