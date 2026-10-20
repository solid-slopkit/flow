# flow

`@solid-slopkit/flow`: SolidJS 2.x primitives for building node-based editors and interactive diagrams.

## Language

Add each term as it is decided: the term in bold, a one- or two-sentence definition, and the words to avoid.

### The graph

**Flow**:
The whole editor surface: one Viewport with the Nodes and Edges drawn in it.
_Avoid_: canvas, graph, diagram (as component names)

**Node**:
A positioned box on the Flow whose content is the app's own JSX.
_Avoid_: vertex, block, card

**Port**:
A point on a Node where Edges attach.
_Avoid_: handle, connector, socket, anchor

**Edge**:
A line drawn between two Ports, part of the app's data.
_Avoid_: connection, link, wire

**Edge shape**:
How an Edge's line runs between its two ends: bezier, straight, step, smooth step, routed step (orthogonal, around Nodes), or one the app supplies.
_Avoid_: edge type, path type, curve

**Route**:
The corners a routed step Edge runs through, going round the Nodes in its way. Routing is computing one.
_Avoid_: path (that is the SVG path data), waypoints

**Obstacle**:
A Node's box that a route goes round, kept a margin from.
_Avoid_: blocker, collider

**Edge label**:
HTML content placed at an Edge's label point, above the Edge lines.
_Avoid_: edge text, annotation

**Source** / **Target**:
The two ends of an Edge. Each names a Node and, optionally, one of its Ports.
_Avoid_: from/to, start/end, input/output (as Edge ends)

**Floating end**:
An Edge end that names a Node but no Port, so it attaches to the Node's outline.
_Avoid_: loose edge, node-to-node edge

**Port kind**:
Which Edge ends a Port accepts: source, target, or both.
_Avoid_: port type, direction

**Parent**:
The Node another Node is nested in. A nested Node's position is relative to its Parent, and it moves with it.
_Avoid_: group (as a relationship), container, subflow

**Measured size** / **Declared size**:
A Node's size as read from the rendered page, versus a size the app gives in its data. A Declared size is used until (or instead of) a Measured one, so a Flow can be drawn without a browser.
_Avoid_: initial size, dimensions

**Flow coordinates**:
Positions in the Flow's own space, independent of pan and zoom. Screen coordinates are what the pointer reports.
_Avoid_: world coordinates, canvas coordinates

### Interaction

**Viewport**:
The pan and zoom state that maps Flow coordinates to the screen.
_Avoid_: camera, transform

**Connection**:
The in-progress gesture of dragging from a Port before it becomes an Edge, or is dropped.
_Avoid_: pending edge, draft edge

**Change**:
One edit the Flow proposes to the app's data, such as moving a Node, adding an Edge or selecting. The app decides whether to apply it.
_Avoid_: event, action, patch

**Batch**:
The Changes one gesture produces at one moment, applied together. A continuous gesture produces batches in phases: start, update, end.
_Avoid_: transaction, change set

**Inverse**:
The Change that undoes another. Every Change carries what it replaced, so its Inverse needs nothing else.
_Avoid_: reverse, rollback

**History**:
The undo and redo stacks of finished Batches, one entry per gesture.
_Avoid_: undo stack, timeline

**Selection**:
The Nodes and Edges flagged as selected in the app's data.
_Avoid_: focus (that is keyboard focus, a different thing)

**Layout**:
Computing positions for a Flow's Nodes (and routes for its Edges) automatically, returned as a Batch of Changes.
_Avoid_: auto-arrange, positioning

### Built-in UI

**Background**:
A pattern of dots, lines or crosses behind the Nodes and Edges, moving with the Viewport.
_Avoid_: grid (as a component name), canvas

**Controls**:
The buttons over the Flow for zooming, fitting the view and locking editing.
_Avoid_: toolbar, zoom panel

**MiniMap**:
A small overview of the whole Flow, with the visible area, that pans and zooms the Viewport.
_Avoid_: overview, navigator, preview

**Panel**:
Built-in UI placed in a corner over the Viewport (Controls, a MiniMap), whose input is its own.
_Avoid_: overlay, widget

### Package docs

**Skill**:
A task-oriented guide for coding agents (`skills/<area>/SKILL.md`), shipped in the package.
_Avoid_: guide, recipe

**LLM reference**:
Handwritten Markdown for agents next to the source, shipped in the package: one page per area. `llms.md` is the package's index.
_Avoid_: llms.txt (that is only the index), API docs
