# Nodes

A `<Node>` draws one record of the Flow's state (see [model](../model/model.md)) with the app's own JSX as content. The app renders the Nodes itself, in the Flow's children, flat: a nested Node is written next to its Parent and names it in data, so re-parenting never moves its DOM.

```tsx
import { Flow, Node, NodeResizer } from '@solid-slopkit/flow';

<Flow state={flow} onChange={(batch) => applyChanges(setFlow, batch)}>
  <For each={flow.nodes}>
    {(node) => (
      <Node id={node.id} class="card">
        <NodeResizer minWidth={80} />
        <h3>{node.data.title}</h3>
      </Node>
    )}
  </For>
</Flow>;
```

## `<Node>`

| Prop             | Type          | Description                                                            |
| ---------------- | ------------- | ---------------------------------------------------------------------- |
| `id`             | `string`      | The record's id. Required; it doesn't change for the life of the Node. |
| `dragHandle`     | `string`      | A selector: dragging starts only on matching elements inside the Node. |
| `keepInParent`   | `boolean`     | Keep the Node inside its Parent while dragging.                        |
| `aria-label`     | `string`      | Its name for assistive technology and announcements; default its text. |
| `class`, `style` |               | On the Node element (`.slp-flow-node`).                                |
| `children`       | `JSX.Element` | The content.                                                           |

- It is a focusable `role="group"` named by its `aria-label`, else its text (see [accessibility](../accessibility/accessibility.md)).
- Its element sits in a `div.slp-flow-node-slot` with `display: contents`, which has no box of its own. With the Flow's `onlyRenderVisible`, the element and its content are rendered only while the Node is near the visible area, and its Measured size is kept in between (see [rendering only visible Nodes](../flow/flow.md#rendering-only-visible-nodes)).
- It is drawn at its absolute position: its `position` plus its Parents'. A Node with a Declared `size` gets that width and height; otherwise its content sizes it.
- Drawing order follows nesting: a Node above its Parent, and a later top-level Node above an earlier one together with all that one's children.
- Attributes for styling: `data-selected`, `data-draggable` (it can be dragged now), `data-dragging`, `data-drop-target` (dragged Nodes would be nested in it on drop).
- `useNode()` inside the content returns `{ id() }`, the Node it is in. Throws outside a Node.

## Measuring

The Flow measures every rendered Node with `ResizeObserver`, in layout pixels (the zoom doesn't change them), and keeps the Measured sizes as its own state, keyed by Node id: `useFlow().measuredSize(id)`. Geometry, `fitView` and dragging use the Measured size, else the Declared one.

Ports are `<Port>`s (see [ports](../port/port.md)), or any elements inside a Node with `data-flow-port="<port id>"`. Each is measured with its centre relative to the Node's top-left corner, and its side from `data-flow-port-side`, else the side of the Node it is nearest: `useFlow().measuredPort(node, port)` returns `{ x, y, side }`. A Node with no area (hidden, not laid out) has neither a Measured size nor measured Ports.

## Dragging

Pressing a Node and moving the pointer more than 3 screen pixels drags it. Each step sends a Batch of `move` Changes: phase `start`, then `update`s, then `end` (see [changes](../changes/changes.md)), so a whole drag is one History entry.

- Dragging a selected Node drags every selected Node. A Node whose Parent also moves goes with it and gets no Change of its own.
- A click that doesn't pass the threshold selects the Node instead (see [selection](../selection/selection.md)).
- Never dragged: Nodes with `draggable: false`, every Node in a read-only Flow, presses on `input`, `textarea`, `select`, editable content, Ports (they start a Connection) or anything inside `data-flow-nodrag`, and presses outside the `dragHandle` when one is set.
- Positions move in Flow coordinates, so the Node follows the pointer at any zoom. Dragging a Node never pans the Flow.
- A cancelled pointer (`pointercancel`) ends the drag with Changes back to where it started.

Options on the `<Flow>`:

- `snapToGrid`: `number | [x, y]`. The Node under the pointer lands on the grid; other dragged Nodes keep their offset to it.
- `alignmentGuides`: `boolean | { threshold?: number }`. Lines up the Node's left, centre and right (top, middle and bottom) with other Nodes' within `threshold` screen pixels (default 6), and draws a guide for each line that matches. Wins over the grid on the axis it snaps.
- `reparentOnDrop`: `boolean | (node, parent) => boolean`. On drop, the dragged Nodes are nested in the topmost Node under the pointer, or made top-level over empty space, with `reparent` Changes in the `end` Batch that keep them where they are on screen. The function decides per Node and Parent (`parent` is `undefined` for top level). Nodes with `keepInParent` never change Parent.

## `<NodeResizer>`

Handles on the edges and corners of the Node it is placed in. Dragging one sends `resize` Batches in phases, setting the Declared size (and the position, for the top and left edges); a content-sized Node starts from its Measured size.

| Prop                    | Type      | Default                      |
| ----------------------- | --------- | ---------------------------- |
| `minWidth`, `minHeight` | `number`  | `10`                         |
| `maxWidth`, `maxHeight` | `number`  | unlimited                    |
| `keepAspectRatio`       | `boolean` | `false`                      |
| `visible`               | `boolean` | whether the Node is selected |

The handles are hidden in a read-only Flow. Pressing one never drags the Node. Classes: `.slp-flow-resizer`, `.slp-flow-resizer-handle` with `data-handle` (`top-left`, `top`, …, `left`).
