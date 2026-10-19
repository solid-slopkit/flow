# Copy, cut and paste

The Flow copies, cuts and pastes through the system clipboard's `copy`, `cut` and `paste` events (ADR 0022), so the keyboard shortcuts and the browser's Edit menu work, and so does pasting into another tab or another Flow. The events reach the Flow while it, or something in it, has focus (see [selection](../selection/selection.md)). In a text field inside a Node they are the field's own.

## Copy

Copy writes the selected Nodes, every Node nested in them, and the Edges between two of those, as JSON in two formats: `application/x-slopkit-flow+json` and `text/plain`.

```ts
type ClipboardPayload<N, E> = { nodes: FlowNode<N>[]; edges: FlowEdge<E>[] };
```

- Records are copied whole through JSON, without their `selected` flag, so `data` must be JSON.
- A Node whose Parent isn't copied becomes top-level, at its absolute position.
- Edges to Nodes outside the copy are left out; a selected Edge is copied only with both its Nodes.
- Without a selected Node, nothing is written and the event keeps its default.

## Cut

Copy, then remove the selected Nodes and Edges in one `remove` Change, as Delete does. Nothing in a read-only Flow.

## Paste

Paste reads the custom type, else `text/plain` if it holds a payload, and sends one Batch:

1. `select` Changes clearing the Selection,
2. an `add` Change with the pasted Nodes and Edges, all selected.

- Every Node and Edge gets a new id from the Flow's `createId` (default `crypto.randomUUID()`). Parents and Edge ends are rewritten to the new ids; an Edge whose Node isn't in the payload is dropped, and so is a Parent that isn't.
- The top-left corner of the top-level Nodes lands at the pointer when it is over the Flow, else 20 Flow units right and down from where the copy was.
- Text that isn't a payload is left to the page. Nothing in a read-only Flow.

## Transforming the payload

Two Flow props let the app change what goes in and out, for example to strip private data or to give pasted records fresh data:

| Prop             | Called with                                              | Return `undefined` to |
| ---------------- | -------------------------------------------------------- | --------------------- |
| `transformCopy`  | the payload copy and cut are about to write              | write nothing         |
| `transformPaste` | the payload about to be added: new ids, placed, selected | add nothing           |

```tsx
<Flow
  transformCopy={(payload) => ({
    ...payload,
    nodes: payload.nodes.map(({ data, ...node }) => ({ ...node, data: publicPart(data) })),
  })}
  transformPaste={(payload) => ({
    ...payload,
    nodes: payload.nodes.map((node) => ({ ...node, data: { ...node.data, copy: true } })),
  })}
/>
```
