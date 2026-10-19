# Selection and the keyboard

The Selection is the Nodes and Edges flagged `selected` in the app's data (ADR 0014). The Flow never sets the flag itself: clicks, the selection box and the keyboard send `select` Changes like any other edit, so selecting from outside the Flow, or saving the Selection, needs nothing special. Applied with `applyChanges`, a selected Node or Edge gets `data-selected` and is drawn in `--slp-flow-selection-color`.

History skips `select` Changes unless asked to record them (see [history](../history/history.md)).

## Clicking

A press and release that doesn't move past 3 screen pixels is a click. A drag is never a click, even one that ends where it started.

| Click on                                | Without a modifier   | With Shift, Ctrl or Meta                  |
| --------------------------------------- | -------------------- | ----------------------------------------- |
| a Node (anywhere in it, its Ports too)  | selects it alone     | adds it to the Selection, or takes it out |
| an Edge: its line, an end, or its label | selects it alone     | adds it to the Selection, or takes it out |
| empty space                             | clears the Selection | nothing                                   |

- Each click is one Batch of `select` Changes without a phase, holding only the flags that change; none when nothing changes.
- An Edge takes clicks on a wide invisible line along it (`path.slp-flow-edge-hit`, 12 Flow units wide), drawn under its own line in an interactive Flow, whatever its children.
- Dragging a selected Node drags every selected Node with it (see [nodes](../node/node.md)).
- A read-only Flow sends nothing.

## The selection box

Shift-dragging empty space draws the selection box instead of panning.

- Nodes are picked by `selectionMode`, a Flow prop: `partial` (the default) takes every Node the box overlaps, `full` only the Nodes wholly inside it. An Edge is picked when both its Nodes are.
- The box replaces the Selection. With Ctrl or Meta held as well, it adds to the Selection.
- It sends `select` Batches in phases: `start` when it passes 3 pixels, `update` whenever the Selection it makes changes, `end` (with no Changes) on release, so the app sees the Selection live.
- `div.slp-flow-selection-box` is drawn over the Flow in pixels, outside the Viewport's transform: a 1 px border and a 10% fill in `--slp-flow-selection-color`.

## The keyboard

The Flow's root has `tabindex="0"`, and its Nodes, Ports and Edges `tabindex="-1"`: a click focuses what it lands on (empty space focuses the root), and Tab focuses the root, then moves over the Nodes, Ports and Edges in spatial order, where Space selects (see [accessibility](../accessibility/accessibility.md)). These keys act on a focused Flow, or on anything focused inside it:

| Key               | Does                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Arrow keys        | move the selected Nodes 1 Flow unit; with Shift, 10. One `move` Batch per key press.     |
| Delete, Backspace | remove the selected Nodes and Edges, with the Nodes nested in them and the Edges at them |
| Escape            | cancels a Connection, dragged or from the keyboard; otherwise clears the Selection       |

- Arrow keys move only Nodes that can be dragged (`draggable` isn't `false`); a selected Node whose Parent is also selected moves with it.
- The removal is one `remove` Change built like `removal(state, { nodes, edges })` (see [changes](../changes/changes.md)), so undoing it puts everything back where it was.
- Keys typed in an `input`, `textarea`, `select` or editable content are the field's own, and so are keys with Ctrl, Meta or Alt held. A handled key's default action is prevented.
- Removing the focused Node or Edge moves focus to the Flow's root.
- Each of these Batches is announced in the Flow's live region (see [accessibility](../accessibility/accessibility.md)).
- A read-only Flow moves and removes nothing; Escape still cancels and clears.

## Focus styling

`.slp-flow:focus-visible` has a 2 px outline in `--slp-flow-selection-color`, inset. Focus from a click shows no ring.
