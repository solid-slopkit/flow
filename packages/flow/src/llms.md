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

The data model, Changes and History are plain TypeScript and work without a DOM.

- Surface: `Flow`, `useFlow`, `Viewport`.
- Nodes: `Node`, `useNode`, `NodeResizer`, `MeasuredPort`.
- Ports: `Port`, `PortInfo`.
- Edges: `Edge`, `useEdge`, `EdgePath`, `EdgeMarker`; shapes `bezierShape`, `straightShape`, `stepShape`, `smoothStepShape`, `edgeShapes`, `EdgeShape`, `EdgeGeometry`, `EdgeShapeContext`.
- Records: `FlowState`, `FlowNode`, `FlowEdge`, `End`, `PortSpec`, `Side`, `PortKind`, `EdgeShapeName`, `Point`, `Size`, `Rect`; `indexFlow` for lookups by id.
- Geometry: `absolutePosition`, `nodeBounds`, `portPoint`, `floatingPoint`, `edgeEnds`, `MeasuredSizes`, `MeasuredPorts`.
- Edits: `Batch`, `Change` and its kinds, `invert`, `applyChanges`, `removal`.
- Undo: `createHistory`.

## References

- [Flow and Viewport](flow/flow.md): `<Flow>` and its props, pan and zoom gestures, `useFlow`, `fitView`, server rendering.
- [Nodes](node/node.md): `<Node>`, measuring, dragging, nesting, snapping, alignment guides, `<NodeResizer>`.
- [Ports](port/port.md): `<Port>`, its side, kind and `max`, measured versus declared Ports.
- [Edges](edge/edge.md): `<Edge>`, Edge shapes, custom Edges with `useEdge`, markers, labels.
- [Data model](model/model.md): `FlowState` and its records, `indexFlow`.
- [Geometry](geometry/geometry.md): absolute positions, Node bounds, Port points, Floating ends.
- [Changes and Batches](changes/changes.md): every Change, phases, `invert`, `applyChanges`, `removal`.
- [History](history/history.md): `createHistory`, undo and redo over Batches.
