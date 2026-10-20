# Data model

The app keeps the Flow's data in its own store as one `FlowState`. The Flow reads it and never writes it; every edit comes back as a Batch of Changes (see [changes](../changes/changes.md)). All of it is plain data and works without a DOM.

```ts
import type { FlowState } from '@solid-slopkit/flow';

type Task = { title: string };
const [flow, setFlow] = createStore<FlowState<Task, null>>({
  nodes: [
    { id: 'group', position: { x: 0, y: 0 }, size: { width: 400, height: 300 }, data: { title: 'Sprint' } },
    {
      id: 'a',
      parent: 'group',
      position: { x: 20, y: 40 },
      size: { width: 160, height: 60 },
      ports: [{ id: 'out', side: 'right', kind: 'source' }],
      data: { title: 'Write' },
    },
    {
      id: 'b',
      position: { x: 500, y: 40 },
      ports: [{ id: 'in', side: 'left', kind: 'target', max: 1 }],
      data: { title: 'Ship' },
    },
  ],
  edges: [{ id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' }, shape: 'smooth-step', data: null }],
});
```

## Types

| Type                    | Fields                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `FlowState<N, E>`       | `nodes: FlowNode<N>[]`, `edges: FlowEdge<E>[]`                                                                |
| `FlowNode<D>`           | `id`, `position: Point`, `parent?`, `size?: Size`, `selected?`, `draggable?`, `ports?: PortSpec[]`, `data: D` |
| `FlowEdge<D>`           | `id`, `source: End`, `target: End`, `shape?: EdgeShapeName`, `route?: Point[]`, `selected?`, `data: D`        |
| `End`                   | `{ node: string; port?: string }`. Without `port` it is a Floating end.                                       |
| `PortSpec`              | `id`, `side: Side`, `offset?`, `kind?: PortKind`, `max?`                                                      |
| `Side`                  | `'top' \| 'right' \| 'bottom' \| 'left'`                                                                      |
| `PortKind`              | `'source' \| 'target' \| 'both'` (default `both`)                                                             |
| `EdgeShapeName`         | `'bezier' \| 'straight' \| 'step' \| 'smooth-step' \| 'routed-step'` (default `bezier`)                       |
| `Point`, `Size`, `Rect` | `{ x, y }`, `{ width, height }`, `{ x, y, width, height }`                                                    |

- `position` is relative to the Parent's top-left corner when `parent` is set, else in Flow coordinates.
- `size` is the Declared size: used until the Flow measures the Node, or instead of measuring on the server.
- A Port id is unique within its Node only, so templates reuse `"in"` and `"out"`.
- `PortSpec.offset` is where along the side the Port sits, as a fraction of the side's length from its top or left corner (default `0.5`). `max` limits how many Edges it accepts.
- `draggable` defaults to `true`.

## `indexFlow(state)`

Lookups by id over one `FlowState`, built once in O(Nodes + Edges). It does not follow later edits: build it inside a `createMemo` to keep it current. It only reads ids, `parent` and Edge ends, so moving a Node doesn't rebuild it.

```ts
const index = createMemo(() => indexFlow(flow));
index().node('a'); // FlowNode | undefined
index().edge('ab'); // FlowEdge | undefined
index().edgesOf('a'); // Edges with 'a' at either end; a loop once
index().childrenOf('group'); // Nodes whose parent is 'group'
```
