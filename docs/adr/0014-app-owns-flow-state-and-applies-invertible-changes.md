# The app owns the Flow state and applies invertible Changes

The app keeps the Flow's data in its own store, as one `FlowState { nodes, edges }` made of library-defined records with a typed app payload:

```ts
type FlowNode<D> = { id; position; parent?; size?; selected?; draggable?; ports?; data: D };
type FlowEdge<D> = { id; source: End; target: End; shape?; selected?; data: D };
```

`<Flow>` reads this state for geometry and never writes it. Every edit the user makes (a move, a Connection, a removal, a Selection, a resize, a paste, a drop, a Layout) arrives as a **Batch** of typed **Changes** through one `onChange(batch)`. The app decides what to apply; `applyChanges(store, batch)` applies a Batch in one store write for the common case. Continuous gestures produce Batches in phases (`start`, `update`, `end`), and every update goes through the app, so other clients can follow a drag live.

Every Change carries the value it replaces (`move` has `from` and `to`, `remove` carries the removed records), so its Inverse needs nothing else. `createHistory()` records Batches at `end`, merges a whole drag into one entry, and skips Selection Changes unless asked to record them.

Selection is part of the app's data (a `selected` flag), so selecting from outside the Flow, or persisting it, needs nothing special. Measured sizes are the exception: they come from the page, not from the user, and stay library state keyed by Node id (ADR 0015).

## Considered Options

- **The library owns the state** and the app reads it back: rejected. Validation, persistence, undo and collaboration all need to step in between a gesture and its effect, and two sources of truth drift.
- **One callback per gesture** (`onNodeMove`, `onConnect`, `onDelete`…): rejected as the primary API. Each feature adds a callback, and undo or collaboration would have to listen to all of them. Such callbacks may exist as filters over the Batch stream.
- **Snapshots for undo:** rejected. Memory grows with the Flow on every step, and restoring a snapshot overwrites concurrent remote edits.
- **Any data shape, read through accessor functions:** rejected. Every helper (History, Layout, routing, clipboard) would need the full set of accessors, and the types become hard to follow.
- **Two arrays instead of one state object:** rejected, so a Batch touching Nodes and Edges is one write.
