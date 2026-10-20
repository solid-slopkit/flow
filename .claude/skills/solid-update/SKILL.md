---
name: solid-update
description: Move the repo to a new Solid 2.x prerelease (solid-js, @solidjs/web and the packages released with them) - read the changelogs, check the code against every change, bump the ranges and the peer floor, fix what breaks, and verify in tests and the docs site. Use when the user asks to update, upgrade or migrate Solid, solid-js or @solidjs/*, or names a version like "rc.16".
---

# Updating Solid

`solid-js`, `@solidjs/web`, `@solidjs/signals`, `@solidjs/diagnostics`, `@solidjs/compiler` and `@solidjs/babel-plugin` release in lockstep as `2.0.0-rc.N`. `@solidjs/router`, `@solidjs/vite-plugin`, `@solidjs/meta` and `@solidjs/testing-library` release separately, and some of them peer on a minimum rc. Moving to a new rc means reading what changed, checking our code against it, then bumping. A green test run alone isn't enough, because a change can alter behavior that no test covers yet.

Update to the version the user names, even if a newer one exists. Mention the newer one at the end.

Run every command with mise's Node: start each shell with `eval "$(mise env -s bash)"`.

## 1. See where we are

- `git status --short` is clean. If it isn't, ask before mixing the update into other work.
- Declared ranges: `grep -rn "solid" package.json apps/*/package.json packages/*/package.json`. `packages/flow` declares `solid-js`, `@solidjs/web` (`>=2.0.0-rc.N <3`), `@solid-slopkit/components` and the optional `elkjs` as peers and `@solidjs/diagnostics` as a dev dependency. `apps/docs` declares the rest.
- What is actually installed. The lockfile can be ahead of the declared ranges or behind them:

  ```bash
  grep -nE "^  '?(solid-js|@solidjs/[a-z-]+|@solid-slopkit/[a-z-]+)@" pnpm-lock.yaml
  ```

- What exists: `npm view <pkg> dist-tags` for each package. Solid 2.x is on the `next` tag.

## 2. Read the changelogs, all of them

The release notes are on GitHub, one release per package and version. Read every rc between the installed one and the target, not just the target:

```bash
for p in solid-js @solidjs/signals @solidjs/web @solidjs/diagnostics; do
  echo "======== $p"
  gh release view "$p@2.0.0-rc.N" --repo solidjs/solid --json body -q .body | grep -v "Updated dependencies"
done > <scratchpad>/solid-rc.N.md
```

Most of the changes live in `@solidjs/signals` and `@solidjs/web`. The `solid-js` release mostly lists dependency bumps. The notes run to tens of KB, so save them to the scratchpad and go through them in two passes:

1. `grep -n -iE "breaking|renamed|removed|no longer|deprecat|instead of"` for the headline changes.
2. A skim of every entry's first line (`grep -nE "^(- |  - )" | cut -c1-260`), because behavior changes are often not marked "breaking".

The router's releases are in `solidjs/solid-router`, tagged `v2.0.0-next.N`:

```bash
gh release list --repo solidjs/solid-router --limit 8
gh release view v2.0.0-next.N --repo solidjs/solid-router --json body -q .body
```

Most of the notes are about SSR, frames, server functions and hydration internals. Pick out the entries that can reach this package:

| Kind of change                                                                  | Where to look in this repo                                                                                                               |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Store and projection semantics (derived stores, `reconcile`, `snapshot`, holds) | The graph model, history and changes (`src/model`, `src/history`, `src/changes`): `createStore`, `createProjection`, `snapshot`          |
| Writable derived signals and memos                                              | `createSignal(() => …)` and `createMemo` in node, edge and selection state                                                               |
| `latest`, `onSettled`, `flush` timing                                           | `grep -rn "latest(\|onSettled\|flush()"`; the editor and layout code                                                                     |
| `<Show>` / `<For>` and list reconciliation                                      | Node, edge and port rendering (`src/node`, `src/edge`, `src/port`)                                                                       |
| DOM runtime, spreads and `assign`                                               | `spread`/`assign`/`merge` uses; the browser tests (`*.browser.test.tsx`, `test/layout.browser.test.tsx`, `test/styles.browser.test.tsx`) |
| SSR (`renderToString`)                                                          | `test/render.tsx` and the `server` vitest project (`*.server.test.tsx`)                                                                  |
| Diagnostics codes and matchers                                                  | `test/capture.ts` and the tests that call `captureArtifact`                                                                              |
| Renamed or removed exports and types                                            | `grep -rn` for each name                                                                                                                 |

Search with `grep -rnE … --include='*.ts' --include='*.tsx' --include='*.md' --exclude-dir=node_modules --exclude-dir=dist packages apps`. Quote the include globs, because zsh expands them otherwise.

For each change that touches us, decide one of:

- **No effect:** say why in a line.
- **Fixes something we document:** add a test that pins the documented behavior.
- **Breaks or changes something:** fix it, or bring it to the user if it is a design decision (public API, an ADR).

## 3. Check the companion packages

A new rc can make the router or the vite plugin need a matching version, and a new router can need the new rc:

```bash
for p in @solidjs/router @solidjs/vite-plugin @solidjs/meta @solidjs/testing-library; do
  echo "$p: $(npm view $p@next peerDependencies --json | tr -d '\n ')"
done
npm view @solidjs/router versions --json | tail -5
```

Pick the newest router version whose peer range accepts the target rc, not just the newest one. Read its changelog for breaking changes, such as route params becoming decoded. The docs app is the only user of the router here.

This repo is part of the `@solid-slopkit` family:

- **`@solid-slopkit/components`.** The docs app and the package (as a peer, `^0.1.0`) use the published version, and it has its own Solid peer range. That range must accept the target rc: `npm view @solid-slopkit/components@<installed version> peerDependencies`. If it doesn't, a newer components release is needed first; tell the user instead of forcing it. `pnpm-workspace.yaml` exempts `@solid-slopkit/components@0.1.0` from the release-age policy, so moving to a newer components version means updating that entry too.

## 4. Bump

Edit the ranges in `apps/docs/package.json` and `packages/flow/package.json`:

- `solid-js`, `@solidjs/web` and `@solidjs/diagnostics`: `^2.0.0-rc.N`.
- The peer floor in `packages/flow`: `>=2.0.0-rc.N <3`. Raise it to the target, because the tests only run against that version.
- The router and other companions, if step 3 said so.

Then install, and make pnpm move the whole family:

```bash
pnpm install
pnpm -r update solid-js @solidjs/signals @solidjs/compiler @solidjs/babel-plugin
pnpm peers check
grep -nE "^  '?(solid-js|@solidjs/[a-z-]+)@" pnpm-lock.yaml
```

`pnpm install` alone can keep the old `solid-js` even though nothing accepts it anymore. It also keeps `@solidjs/compiler` and `@solidjs/babel-plugin` (which the vite plugin depends on) at the old rc. Every lockstep package must end on the target rc, and `pnpm peers check` must report no issues. Check that `git diff -- '*.json'` changes only the ranges you meant to change.

## 5. Run the checks

```bash
pnpm -r --if-present typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm --filter docs build && pnpm release:check
```

Send the output to a scratchpad log and grep it (`Test Files|Tests |error TS| FAIL `), because it is long. Lint warnings in files you didn't touch were there before. If a Solid diagnostic code shows up, read `node_modules/solid-js/skills/reactivity-diagnostics/SKILL.md` for the fix. That skill ships with the installed version, so read it after the bump.

## 6. Verify what the changelog says in practice

When a change can't be ruled out by reading, check it with a throwaway test in `packages/flow/src/__probe/`. Exercise the code involved, print what you need through a failing `expect(...).toEqual({})`, run it with `npx vitest run --project unit <file>` from `packages/flow`, then delete the folder. Then pin each finding with a real test next to the code.

If the change is visible in the browser, check the docs site too. `.claude/launch.json` runs it on port 3100. If another session holds that port, add a temporary entry on another port (with `--force` so Vite re-bundles the new dependencies), use it, and `git checkout -- .claude/launch.json` when you're done. Read computed values with `javascript_tool`. The pane may be hidden, which pauses CSS transitions and animation frames, so take a screenshot before trusting a computed value.

## 7. Changeset and commit (ask first)

Add a changeset for `@solid-slopkit/flow`. Raising the peer floor is a `patch`. Breaking changes to our own API take a `minor` while the version is 0.x. Name what users will notice: the new minimum version and any behavior that changed. If an unreleased changeset from an earlier Solid update is still pending, replace it instead of adding a second minimum-version note.

Show the user the result and ask before committing. Keep the dependency bump in its own commit (`build: require Solid 2.0.0-rc.N`), separate from any fix it led to. When staging a changeset you moved with `git mv`, use `git add -A <old> <new>`. Write in the commit body what you checked and why nothing else needed to change. End commit messages with the attribution lines the conversation gives.

## Don'ts

- Don't upgrade past the version the user asked for.
- Don't change public API or an ADR decision on your own. Show the evidence and ask.
- Don't leave the lockstep packages on different rcs.
- Don't push. That's the user's call, like the release (`.claude/skills/release/SKILL.md`).
