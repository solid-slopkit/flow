# @solid-slopkit/flow roadmap to 0.0.1

0.0.1 is the first release. Decisions live in [docs/adr](../../../docs/adr) and vocabulary in [CONTEXT.md](../CONTEXT.md). Use its terms in code, tests and docs.

## Rules for agents

- **Do one step at a time.** Only implement the step you were asked for, identified by its ID (e.g. `F1.04`). Don't start the next step, finish a whole milestone, or build "while I'm here" extras, even when the next step looks small or obviously related.
- A step that needs something that doesn't exist yet is **blocked**. Say so and stop; don't build the dependency inside the step.
- When a step is done, tick its box in this file in the same commit.

## Definition of done (every step)

- jsdom tests for behavior and reactivity. Tests that need real layout or real pointer input go in the browser project (`*.browser.test.tsx`).
- `toHaveNoDiagnostics()`, plus a re-run budget on the main update path (`@solidjs/diagnostics/vitest`).
- The LLM reference for the topic (next to the source, indexed in `src/llms.md`, ADR 0012) is updated in the same commit.
- Exported from the package entry.

---

## F0 — Foundations

- [x] **F0.01** Package scaffold: `package.json` (the `solid` export condition, ADR 0001), `tsconfig.json` / `tsconfig.build.json`, build and typecheck scripts, a jsdom and a Chromium vitest project, an empty entry, the docs site and the release workflow. `pnpm build`, `test`, `lint` and `format:check` pass from the root.

TODO: the steps after the scaffold.
