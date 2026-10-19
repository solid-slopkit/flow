# Distribute on npm with uncompiled JSX

`@solid-slopkit/flow` is published to the public npm registry under the `@solid-slopkit` scope, and consumers install it by name (`pnpm add @solid-slopkit/flow`). A tag `v<version>` (e.g. `v0.2.0`) starts the release workflow, which builds the package, publishes it to npm from its folder, and creates a GitHub Release whose notes are the changelog section. Changesets sets the version and writes the changelog. The workflow authenticates to npm with trusted publishing (GitHub OIDC), so the repo holds no npm token. The published package contains `.jsx` with JSX preserved, plus `.d.ts` declarations, both emitted by `tsc`. It is exposed through the `solid` export condition, so the consumer's Solid plugin compiles the components for its own targets (server, client, dev). We ship no per-target builds.

## Considered Options

- **Raw `.ts`/`.tsx` with `exports` pointing at `src`.** Rejected: `skipLibCheck` does not cover `.ts` files, so consumers would type-check the library source under their own compiler options. Stricter settings would then fail inside `@solid-slopkit/flow`.
- **Precompiled server/client/dev builds.** Rejected: the consumer's Solid plugin already does this, and doing it here would lock the output to one Solid compiler version.
- **Tarballs attached to GitHub Releases, installed by URL:** rejected. Consumers would have to look up the release, `package.json` would hold a URL instead of a version range, upgrades would mean editing that URL, and package managers couldn't report outdated versions or resolve ranges.
- **Tarballs committed to the repo:** rejected, because binaries would pile up in git history.
- **Git URL installs** (`github:solid-slopkit/flow#tag`): rejected. The package lives in `packages/flow`, not at the repo root, its build output isn't committed, and a git URL has the same version-range problems as a tarball URL.
- **An npm token stored as a repo secret:** rejected in favour of trusted publishing. A long-lived token can leak and has to be rotated.
- **`changeset publish`:** not used. It publishes whatever versions the registry lacks and tags them itself, while our release is started by a tag the workflow checks against the version.
- **Packing tarballs first and publishing those:** dropped. npm packs the package itself when it publishes, and no check ran against the tarball. `pnpm release:check` runs `npm pack --dry-run`, which lists the files npm would publish, for a look before releasing.
