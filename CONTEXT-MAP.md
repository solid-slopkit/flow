# Context Map

slopkit is a family of packages for SolidJS 2.x. Each package is its own context with its own vocabulary and decisions, and lives in its own repository. This repository holds one of them: flow. Read this file, then [packages/flow/CONTEXT.md](./packages/flow/CONTEXT.md).

## Contexts

- [flow](./packages/flow/CONTEXT.md) (`@solid-slopkit/flow`): TODO: one line on what the package does. Decisions in [packages/flow/docs/adr](./packages/flow/docs/adr), roadmap in [packages/flow/docs/roadmap.md](./packages/flow/docs/roadmap.md).
- threejs (`@solid-slopkit/threejs`): three.js scenes described with Solid components inside a **Canvas**. In [solid-slopkit/threejs](https://github.com/solid-slopkit/threejs).
- Components (`@solid-slopkit/components`): components, their look, theming and the provider. In [solid-slopkit/components](https://github.com/solid-slopkit/components).
- Signal forms (`@solid-slopkit/signal-forms`): schema-driven form state over a Solid store. In [solid-slopkit/signal-forms](https://github.com/solid-slopkit/signal-forms).
- i18n (`@solid-slopkit/i18n`): translation files next to the code that uses them, and the active locale. In [solid-slopkit/i18n](https://github.com/solid-slopkit/i18n).

Decisions that bind the whole family live in [docs/adr](./docs/adr): distribution (0001), dependencies (0002), browser baseline (0010), agent docs in the package (0012), no right-to-left support (0014) and package independence (0016). ADR numbers are unique across the family, so "ADR 0013" names one decision wherever it lives. A new ADR goes in `docs/adr` when it binds every package, otherwise in `packages/flow/docs/adr`.

## Relationships

No package depends on another at runtime; they meet through props (ADR 0016).

- **flow ↔ the others**: none yet.

## Shared language

**Skill**:
A task-oriented guide for coding agents (`skills/<area>/SKILL.md`), shipped in the package.
_Avoid_: guide, recipe

**LLM reference**:
Handwritten Markdown for agents next to the source, shipped in the package: one page per area. `llms.md` is the package's index.
_Avoid_: llms.txt (that is only the index), API docs
