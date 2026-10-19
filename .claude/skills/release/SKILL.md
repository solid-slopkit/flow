---
name: release
description: Release @solid-slopkit/flow under a new version - apply changesets, run the checks, commit, tag v<version>, push, and watch the release workflow publish to npm. Use when the user asks to release, cut a release, publish, ship a version, or bump the version.
---

# Releasing slopkit flow

`@solid-slopkit/flow` is published to npm, one version per `v<version>` tag (ADR 0001). Changesets sets the version. Pushing the tag starts `.github/workflows/release.yml`, which runs every check, builds, publishes the package to npm through trusted publishing, and creates a GitHub Release with the changelog as notes. The README's "Releasing" section is the human version of these steps.

Committing, tagging and pushing are the user's calls. Stop and ask before each one, show what will happen, and never force-push a tag the user hasn't told you to move.

Run every command with mise's Node: start each shell with `eval "$(mise env -s bash)"` (the shell's own Node can be too old for lint).

## 1. Check the starting point

- `git status --short` is clean, and the branch is `main`, up to date with `origin/main` (`git fetch origin && git status -sb`). If not, tell the user and ask how to proceed. Don't switch branches or pull over their work yourself.
- The current version: `node -e "import('./scripts/packages.mjs').then((m) => console.log(m.sharedVersion()))"` (`packages.mjs` reads every `packages/*` folder; there is one).
- The last release: `git tag -l 'v*' --sort=-v:refname | head -1` (none before the first release), and what npm has: `npm view @solid-slopkit/flow versions` (an E404 means nothing is on npm yet; see "First publish" below).

## 2. Make sure there are changesets

List the pending ones: `ls .changeset/*.md | grep -v README.md`, and read each.

If there are none, or they miss changes, draft them from the history since the last tag (`git log --oneline <last-tag>..HEAD -- packages/flow`, or the whole history before the first release):

```md
---
'@solid-slopkit/flow': minor
---

Add a `fitView()` helper.
```

Pick the bump with semver while the version is 0.x: `minor` for new features or breaking changes, `patch` for fixes. Show the user the drafted changesets and the resulting version, and let them edit or confirm before going on. Name the files after what they describe (`.changeset/fit-view.md`).

## 3. Apply them

```bash
pnpm changeset version
```

This writes the new version into `packages/flow/package.json`, appends its `CHANGELOG.md` and deletes the applied changesets. Check `git diff --stat` and the new changelog section.

## 4. Run the checks

The workflow runs these on a GPU-less Linux runner. Running them first saves a failed release:

```bash
pnpm format:check
pnpm lint
pnpm release:check                      # builds the package and lists what npm would publish
pnpm -r --filter "./packages/*" typecheck
pnpm test
pnpm --filter docs build && pnpm --filter docs typecheck
node scripts/release-notes.mjs          # the release notes the workflow will publish
```

In `release:check`'s output, check the file list: `dist/source`, `dist/types`, `skills` and `package.json`, nothing from `src` or tests.

If something fails, stop and report it with the output. Fixing it is a separate change, not part of the release commit.

## 5. Commit, tag and push (ask first)

Show the user the version, the release notes and the file list, then ask for the go-ahead. After a yes:

```bash
git add -A
git commit -m "chore: release v<version>"
git tag v<version>
```

Pushing publishes the release, so ask again before:

```bash
git push origin main v<version>
```

End the commit message with the attribution lines the conversation gives for commits.

## 6. Watch the workflow

```bash
gh run list --workflow release.yml --limit 1
gh run watch <run-id> --exit-status
gh release view v<version>
```

Then check npm: `npm view @solid-slopkit/flow@<version> version dist.tarball`. Report the npm version, the package page (`https://www.npmjs.com/package/@solid-slopkit/flow`) and the release URL. If the run fails, read the failing step's log (`gh run view <run-id> --log-failed`), explain the cause, and ask the user how to proceed. If it failed before the "Publish to npm" step, nothing is published: after a fix lands on `main`, the tag can be moved to it (`git tag -f v<version> && git push -f origin v<version>`), but only when the user says so. If the tag was already shared, a new patch version is safer. If it failed after publishing, the version is on npm for good (npm never accepts the same version twice): rerun the workflow (`gh run rerun <run-id> --failed`), which skips the publish and continues, or release a new patch version if the cause needs a code fix.

## First publish

npm only lets a package trust a workflow once the package exists. If `npm view @solid-slopkit/flow` says E404, tell the user before tagging that these one-time steps are theirs (they need their npm login and 2FA):

1. Own the `@solid-slopkit` scope on npm (an npm organization of that name).
2. Publish the first version by hand: `pnpm release:check && cd packages/flow && npm publish`. Then push the tag as usual: the workflow skips the publish and creates the GitHub Release.
3. On npmjs.com, under the package's Settings → Trusted publishing, add GitHub Actions with the repository `solid-slopkit/flow` and the workflow `release.yml`.

Every later release publishes from the workflow.

## Don'ts

- Don't edit versions in `package.json` by hand; changesets own them.
- Don't publish from your machine (`npm publish`, `pnpm publish`, `changeset publish`). The workflow publishes what it built and checked, with provenance. The one exception is the first publish below, and only when the user runs it.
- Don't unpublish or deprecate versions on npm unless the user asks for it.
- Don't tick roadmap boxes (`packages/flow/docs/roadmap.md`) as part of a release unless the user asked for that roadmap step.
