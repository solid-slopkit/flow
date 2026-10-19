# Using slopkit flow in an app

This guide is for coding agents that add `@solid-slopkit/flow` to a SolidJS 2.x app. It covers how to install it from npm, how to wire it up, and how to make the docs shipped in the package available to future agent sessions.

Repository: https://github.com/solid-slopkit/flow

Docs site: https://solid-slopkit.github.io/flow/. It is built from `main` and can be ahead of the latest release; the docs inside the installed package match the installed version, so prefer those.

## The package

`@solid-slopkit/flow`: SolidJS 2.x primitives for building node-based editors and interactive diagrams. It builds its controls and look on `@solid-slopkit/components`, a peer dependency the app installs and sets up alongside it (ADR 0016).

It needs `solid-js` and `@solidjs/web` 2.x, which a Solid 2 app already has. It ships uncompiled JSX under the `solid` export condition, so the app compiles it with its own Solid plugin (`@solidjs/vite-plugin`). This needs no configuration.

## 1. Install

```bash
pnpm add @solid-slopkit/flow @solid-slopkit/components
```

## 2. Set it up

The package has an index for agents at `node_modules/@solid-slopkit/flow/dist/source/llms.md`, with a reference per area. Read it.

TODO: the wiring that has to happen once, with a minimal example.

## 3. Make the package docs available to later sessions

The package ships skills (task guides, `skills/<area>/SKILL.md`) and LLM references (the `llms.md` index and the pages it links). Both always match the installed version. Tell future agents about them in the app's agent instructions: add this section to `AGENTS.md`. Create the file if the app has none. If the file has a generated block (the templates' `<!-- BEGIN solid-2.0-primer -->` … `<!-- END solid-2.0-primer -->`), add the section after it, never inside it.

```markdown
## slopkit flow

This app uses `@solid-slopkit/flow`, installed from npm. To upgrade, run `pnpm up @solid-slopkit/flow --latest`.

Read the docs inside the installed package, not the web; they match the installed version:

- `node_modules/@solid-slopkit/flow/dist/source/llms.md`: the package's index, with a reference per area. Skills: `node_modules/@solid-slopkit/flow/skills/<area>/SKILL.md`.

Before working with the package, read the skill for the task first, then the reference for each area you use.
```

**Claude Code** reads `CLAUDE.md`, not `AGENTS.md`. If the app has no `CLAUDE.md`, create one that contains the line `@AGENTS.md`. To make the skills load on their own when a task matches them, also link each one into `.claude/skills`:

```bash
mkdir -p .claude/skills
for skill in node_modules/@solid-slopkit/*/skills/*/; do
  ln -sfn "../../$skill" ".claude/skills/$(sed -n 's/^name: //p' "$skill/SKILL.md")"
done
```

Commit the links. They are relative and point into `node_modules`, so they resolve after `pnpm install` on any clone and follow upgrades. Run the loop again after an upgrade, to pick up new skills.

## 4. Check it works

1. `pnpm build` succeeds, and `pnpm exec tsc --noEmit` reports no errors.
2. `pnpm dev`, open the app, and check that the page renders and the browser console shows no errors.
