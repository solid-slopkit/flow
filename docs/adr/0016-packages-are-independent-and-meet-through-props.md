# Packages are independent and meet through props

The repo holds a family of packages: `@solid-slopkit/components` (components), `@solid-slopkit/signal-forms` (form state) and `@solid-slopkit/i18n` (translations). None of them depends on another at runtime. Forms and i18n are headless: no CSS and no components of their own besides i18n's provider. Where they work with the components, they produce values the components already take as props:

- `bind()` from forms returns the props a slopkit input takes (`value`, `onChange(value)`, `error`, …).
- A translation file's messages fill a component's text props, and the active locale is passed to `<SlopkitUi locale>`. The two providers don't know each other.

`@solid-slopkit/components` is a dev-only dependency of forms, so its tests and docs demos render the real inputs. Consumers of forms or i18n install no component library.

## Considered Options

- **Put the binding or the translations inside `@solid-slopkit/components`:** rejected. The component library would have to know the forms or i18n API, and every app would ship it.
- **Subpaths of `@solid-slopkit/components`** (`/forms`, `/i18n`): rejected. A headless library would follow the UI package's release cadence and CSS build, which it has no use for.

## Consequences

- The packages share one version and one release (ADR 0001), though none needs another installed.
- A change to the props an input takes can break `bind()`'s types. The forms tests render the real inputs to catch it.
- Docs that show two packages together say how they are wired, since neither does it for the app.
