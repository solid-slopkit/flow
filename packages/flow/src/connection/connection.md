# Connections

A Connection is the gesture of dragging from a Port before it becomes an Edge. Dragging from a Port draws a preview line; dropping it on a Port it may end on sends a `connect` Batch with the new Edge. Dragging an existing Edge's end moves that end to another Port, or off any Port to remove the Edge. While a Connection lasts it is the Flow's own state, not the app's; only its result reaches `onChange`, as one Batch without a phase.

```tsx
import { applyChanges, Edge, Flow, Node, Port } from '@solid-slopkit/flow';

<Flow
  state={flow}
  onChange={(batch) => applyChanges(setFlow, batch)}
  canConnect={(source, target) => source.node !== target.node}
  onConnectEnd={({ position, source }) => addNodeAt(position, source)}
>
  <For each={flow.nodes}>
    {(node) => (
      <Node id={node.id}>
        <Port id="in" side="left" kind="target" max={1} />
        {node.data.title}
        <Port id="out" side="right" kind="source" />
      </Node>
    )}
  </For>
  <For each={flow.edges}>{(edge) => <Edge id={edge.id} />}</For>
</Flow>;
```

## Making an Edge

- Pressing a Port and moving past 3 screen pixels starts a Connection. A press on a Port never drags its Node. Nothing starts in a read-only Flow, or from a Port already at its `max`.
- The preview line runs from the Port to the pointer, or to the Port it snaps to: the valid Port under the pointer, else the nearest valid Port within `connectionRadius` screen pixels (default 20) of it.
- Releasing over a valid Port sends `{ changes: [{ type: 'connect', edge }] }`. The Edge is `{ id: createId(), source, target, data: undefined }`: set its `data` or `shape` in `onChange` before applying it.
- Releasing anywhere else sends nothing. On empty space, away from every Node, the Flow calls `onConnectEnd` (see below).
- A cancelled pointer (`pointercancel`, lost capture) drops the Connection without a Batch.

## Where a Connection may end

Asked in this order, once for each Port when the Connection starts (ADR 0018):

1. **The Port.** A Connection ends on a Port, measured or declared in the Node's `ports`, never on a Node's outline, and never on the Port it started from. Other Ports of the same Node are allowed.
2. **Port kinds.** A `source` Port becomes the Edge's Source and ends on a `target` or `both` Port. A `target` Port becomes the Target and ends on a `source` or `both` Port. A `both` Port becomes the Target when it ends on a `source` Port, else the Source.
3. **`max`.** A Port with as many Edges as its `max` takes no more.
4. **`canConnect(source, target)`**, the Flow's prop: the app's own rule, such as typed Ports or no duplicate Edges. Every Port is allowed without it.

```ts
type ConnectionRule = (source: End, target: End) => boolean;
```

## Reconnecting

Each end of an Edge has an invisible handle, `circle.slp-flow-edge-end` with `data-flow-edge-end="source" | "target"`, 10 Flow units in radius. It is drawn in the Edge layer, under the Nodes, so the Port covers its centre: a press on the Port starts a new Connection, and a press on the Edge just outside the Port grabs its end.

- Dragging a handle starts a Connection from the Edge's other end, which keeps its role. The Edge is hidden (`data-reconnecting`) while the preview line stands in for it.
- Releasing over a valid Port sends `{ type: 'reconnect', edge, end, from, to }`. The Edge being moved doesn't count against a Port's `max`, and the end that stays may be a Floating end.
- Releasing over its own Port sends nothing. Releasing anywhere without a valid Port removes the Edge, as the `remove` Change `removal(state, { edges: [id] })` builds.
- `<Edge reconnectable={false}>` draws no handles. A read-only Flow draws none.

## Dropping on empty space

`onConnectEnd(end)` is called when a new Connection is released away from every Node and no valid Port is within reach, so the app can create a Node there:

```ts
type ConnectEnd = {
  position: Point; // the drop point in Flow coordinates
  source?: End; // the starting Port, when it would be the Source (a `source` or `both` Port)
  target?: End; // the starting Port, when it would be the Target (a `target` Port)
};
```

Exactly one of `source` and `target` is set. Send the new Node and its Edge in one Batch, so they are one History entry:

```tsx
<Flow
  onConnectEnd={({ position, source, target }) => {
    const id = createId();
    const node = { id, position: { x: position.x, y: position.y - 25 }, ports, data: newTask() };
    const edge = source
      ? { id: createId(), source, target: { node: id, port: 'in' }, data: null }
      : { id: createId(), source: { node: id, port: 'out' }, target: target!, data: null };
    onChange({ changes: [{ type: 'add', nodes: [node], edges: [edge] }] }); // the handler the Flow's onChange calls
  }}
/>
```

Reconnecting never calls it: dropping an Edge's end on empty space removes the Edge.

## From the keyboard

Enter on a focused `<Port>` starts a Connection; Tab, Shift+Tab or the arrow keys move focus over the Ports it may end on, Enter on one sends the same `connect` Batch, and Escape cancels. See [accessibility](../accessibility/accessibility.md).

## State and styling

`useFlow().connection()` is the Connection being dragged, `undefined` otherwise. Reactive.

```ts
interface Connection {
  from: End; // the Port pressed, or when reconnecting, the Edge's end that stays
  reconnecting?: { edge: string; end: 'source' | 'target' };
  fromPoint: EndPoint; // drawn from, in Flow coordinates
  toPoint: EndPoint; // drawn to: the snapped Port, else the pointer
  to?: End; // the valid Port it would end on
}
```

| Selector                                 | What it is                                                         |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `.slp-flow[data-connecting]`             | the Flow while a Connection lasts: crosshair cursor, no selection  |
| `svg.slp-flow-connection`                | the preview layer, above the Nodes                                 |
| `.slp-flow-connection-path`              | the preview line: a bezier, dashed in `--slp-flow-edge-color`      |
| `.slp-flow-connection-path[data-valid]`  | snapped to a valid Port: solid, in `--slp-flow-selection-color`    |
| `.slp-flow-port[data-connectable]`       | every `<Port>` in an interactive Flow: crosshair cursor            |
| `.slp-flow-port[data-connecting]`        | the `<Port>` the Connection is drawn from                          |
| `.slp-flow-port[data-connection-target]` | the `<Port>` it snaps to: `--slp-flow-selection-color`, scaled 1.5 |
| `.slp-flow-edge[data-reconnecting]`      | the Edge whose end is dragged: hidden                              |
| `.slp-flow-edge-end`                     | an Edge's end handle: transparent, `cursor: move`                  |

Moving the pointer redraws only the preview line: no Node or Edge re-runs, and a Port only when the Connection snaps to it or leaves it.
