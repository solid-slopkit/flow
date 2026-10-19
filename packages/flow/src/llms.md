# @solid-slopkit/flow

SolidJS 2.x primitives for building node-based editors and interactive diagrams. The app owns the data (nodes and edges in its store) and renders Nodes as its own JSX; the Flow proposes every edit as a Batch of Changes. Each link below is a reference for one area. Paths are relative to this file.

## Setup

```bash
pnpm add solid-js @solidjs/web @solid-slopkit/components @solid-slopkit/flow
```

The Flow is built on `@solid-slopkit/components`: render it inside that package's provider, `<SlopkitUi>`, and load the components' stylesheets before the Flow's.

```tsx
import { SlopkitUi } from '@solid-slopkit/components';
import '@solid-slopkit/components/styles/slopkit.css';
import '@solid-slopkit/components/styles/default-theme.css';
import '@solid-slopkit/flow/styles/flow.css';

export function Root() {
  return <SlopkitUi>{/* your app, with its Flows */}</SlopkitUi>;
}
```

## Styling

`styles/flow.css` puts every rule in the components' `slopkit.components` cascade layer, so unlayered app CSS overrides it. Its colors default to the components theme's tokens, so the Flow follows the app's theme and color scheme. Set these on the Flow or any ancestor to change one:

| Variable                     | Default                     | What it colors                                              |
| ---------------------------- | --------------------------- | ----------------------------------------------------------- |
| `--slp-flow-background`      | `--slp-color-base-100`      | the Flow's surface                                          |
| `--slp-flow-pattern-color`   | `--slp-color-base-300`      | Background dots and lines                                   |
| `--slp-flow-edge-color`      | `--slp-color-muted-content` | Edge lines and markers                                      |
| `--slp-flow-port-color`      | `--slp-color-neutral`       | Ports                                                       |
| `--slp-flow-selection-color` | `--slp-color-primary`       | the Selection, the selection box, a valid Connection target |

## API

Nothing is exported yet.

## References

None yet. Each area gets a reference next to its source (`<area>/<area>.md`), linked here.
