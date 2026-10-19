# Dragging from a palette

`<FlowDraggable>` is an element outside the Flow, such as an entry in a palette or a toolbar, that can be dragged onto any Flow in the page. It uses Pointer Events with pointer capture, like every other gesture, not native drag and drop (ADR 0022), so mouse, pen and touch behave the same and the dragged element is what the user sees.

```tsx
import { Flow, FlowDraggable } from '@solid-slopkit/flow';

<aside>
  <FlowDraggable data={{ kind: 'task' }}>Task</FlowDraggable>
  <FlowDraggable data={{ kind: 'note' }}>Note</FlowDraggable>
</aside>
<Flow
  state={flow}
  onChange={onChange}
  onDrop={({ data, position }) =>
    onChange({ changes: [{ type: 'add', nodes: [newNode(data as Item, position)], edges: [] }] })
  }
/>;
```

## `<FlowDraggable>`

| Prop             | Type          | Description                                       |
| ---------------- | ------------- | ------------------------------------------------- |
| `data`           | `T`           | Handed to the Flow's `onDrop`. Required.          |
| `disabled`       | `boolean`     | Nothing drags while `true`. Sets `data-disabled`. |
| `class`, `style` |               | On its element (`.slp-flow-draggable`).           |
| `children`       | `JSX.Element` | Its content, which is what is dragged.            |

- Pressing it and moving past 3 screen pixels starts the drag. The element follows the pointer (a `transform` on it), with `data-dragging` set.
- Released over a Flow, that Flow calls its `onDrop`. Released anywhere else, or cancelled, nothing happens. It snaps back either way.
- The Flow under the pointer is the topmost element there other than the dragged one: a Flow covered by something else takes no drop. A read-only Flow takes none.
- It needs no Flow around it, and works with several Flows on the page.

## `onDrop`

A Flow prop: `(drop: { data: unknown; position: Point }) => void`. `position` is the release point in Flow coordinates. The Flow sends no Batch of its own: the app adds what it wants, usually a Node at `position`, through the same handler as its `onChange` so History records it.

## Styling

`.slp-flow-draggable` has `touch-action: none`, `user-select: none` and a grab cursor. While dragged it is drawn above the page (`position: relative`, `z-index: 1000`) at 80% opacity, with a grabbing cursor.
