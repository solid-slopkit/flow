# Docs for agents ship inside the package

`@solid-slopkit/flow` contains two sets of docs written for coding agents, versioned with the code:

- `skills/<area>/SKILL.md`: task-oriented guides, following the convention `solid-js` and `@solidjs/diagnostics` use. A consumer's AGENTS.md points at `node_modules/@solid-slopkit/flow/skills/`.
- **LLM references**: handwritten Markdown next to the source, one page per area (`<area>/<area>.md`), plus an index, `llms.md`, at the source root. The build copies them into `dist/source/` with the code, so the paths in the index work in the installed package. When an area's API changes, its reference changes in the same commit.

The docs site is built from `main` and can be ahead of the latest release, so the docs inside the package are the ones that always match the installed version.

## Considered Options

- **Generated from the docs pages and the TypeScript types:** rejected as too much machinery: rendering or parsing the docs pages, and extracting props needs a compiler API that TypeScript 7 only offers as unstable. A handwritten file is a third copy of the API after the types and the docs page, so it can drift. Reviewing the reference with every API change keeps it in line.
- **Serving `/llms.txt` from the docs site:** dropped. The files in the package match the installed version, and an agent can read them without network access.
- **Docs site only:** rejected, because it isn't versioned with the installed package.
