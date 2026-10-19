# @solid-slopkit/flow roadmap to 0.0.1

0.0.1 is the first release. Decisions live in [docs/adr](../../../docs/adr) and vocabulary in [CONTEXT.md](../CONTEXT.md). Use its terms in code, tests and docs.

## Rules for agents

- **Do one step at a time.** Only implement the step you were asked for, identified by its ID (e.g. `F1.04`). Don't start the next step, finish a whole milestone, or build "while I'm here" extras, even when the next step looks small or obviously related.
- A step that needs something that doesn't exist yet is **blocked**. Say so and stop; don't build the dependency inside the step.
- When a step is done, tick its box in this file in the same commit.

## Definition of done (every step)

- jsdom tests for behavior and reactivity. Tests that need real layout or real pointer input go in the browser project (`*.browser.test.tsx`).
- `toHaveNoDiagnostics()`, plus a re-run budget on the main update path (`@solidjs/diagnostics/vitest`).
- The LLM reference for the topic (next to the source, indexed in `src/llms.md`, ADR 0012) is updated in the same commit.
- Exported from the package entry.

---

## F0 — Foundations

- [x] **F0.01** Package scaffold: `package.json` (the `solid` export condition, ADR 0001), `tsconfig.json` / `tsconfig.build.json`, build and typecheck scripts, a jsdom and a Chromium vitest project, an empty entry, the docs site and the release workflow. `pnpm build`, `test`, `lint` and `format:check` pass from the root.

- [x] **F0.02** `@solid-slopkit/components` as a peer and dev dependency (ADR 0016): its provider and stylesheet set up in the test setup and the docs site, and flow's own stylesheet in `@layer` reading the components theme's custom properties. Setup steps in `docs/using-slopkit.md` and `src/llms.md`.

## F1 — Data model

Pure TypeScript, no components yet. Everything here works without a DOM.

- [x] **F1.01** Record types (ADR 0014, 0017, 0018): `FlowNode<D>`, `FlowEdge<D>`, `FlowState`, `End`, `PortSpec` (id, side, offset, kind, `max`), Edge shape names. An id index over a `FlowState` (Node and Edge by id, Edges by Node, children by Parent).
- [x] **F1.02** Geometry: absolute positions through Parents, Node bounds from Measured-else-Declared size, Port points from declared Ports, Floating end points clipped to a Node's outline (ADR 0015, 0017, 0019).
- [x] **F1.03** `Change` and `Batch` types for every edit (`add`, `remove`, `move`, `select`, `resize`, `connect`, `reconnect`, `reparent`, `update`), each carrying what it replaces, and phases. `invert(batch)`.
- [x] **F1.04** `applyChanges(store, batch)`: one store write per Batch; removing a Node removes its Edges and its children.
- [x] **F1.05** `createHistory()`: records Batches at `end`, merges a drag into one entry, skips Selection unless asked, `undo` / `redo` / `canUndo` / `canRedo` returning Batches.

## F2 — Flow and Viewport

- [x] **F2.01** `<Flow>`: takes a `FlowState`, `onChange` and `createId`; its own context, so several Flows share a page; the transformed Node layer, the SVG Edge layer and the HTML label layer (ADR 0015). Read-only mode (`interactive={false}`).
- [x] **F2.02** Viewport state (controlled or uncontrolled), conversion between screen and Flow coordinates, min / max zoom, `setViewport`, `zoomTo`, `zoomIn` / `zoomOut`.
- [x] **F2.03** Pan by dragging empty space, zoom by wheel around the pointer, the scroll-pans option, pinch zoom (ADR 0022). Browser tests.
- [x] **F2.04** `fitView` and `fitBounds`, with padding; on the server from the Flow's declared size (ADR 0019).

## F3 — Nodes

- [x] **F3.01** `<Node>`: positioned from the state, absolute through its Parent, z-order following nesting; renders the app's JSX.
- [x] **F3.02** Measuring with `ResizeObserver` into library state keyed by Node id (ADR 0015); Ports measured relative to their Node.
- [x] **F3.03** Dragging: threshold, `move` Batches with phases, dragging every selected Node together, `draggable`, the drag handle selector and `data-flow-nodrag`.
- [x] **F3.04** Dragging nested Nodes: moving with the Parent, keeping a child inside its Parent when asked, `reparent` by dropping onto a Node.
- [x] **F3.05** Snap to grid while dragging.
- [x] **F3.06** Resizing: `<NodeResizer>` built from components, `resize` Batches with phases, min / max size, keeping aspect ratio.
- [x] **F3.07** Alignment guides while dragging: lines to other Nodes' edges and centres, with snapping to them.

## F4 — Ports and Edges

- [x] **F4.01** `<Port>`: side, kind, `max`, measured position; declared Ports from data used until measured (ADR 0018, 0019).
- [x] **F4.02** `<Edge>` and the shape functions bezier, straight, step and smooth step, with the reserved `context` argument (ADR 0021); Floating ends.
- [x] **F4.03** Custom Edges: the computed path, label point and state exposed to the app's JSX.
- [x] **F4.04** Markers that follow the Edge's stroke, and HTML Edge labels in the label layer.

## F5 — Connections

- [x] **F5.01** Dragging a Connection from a Port, its preview line, dropping on a Port to send a `connect` Batch; Port kinds, `max` and `canConnect` decide where it may end; snapping to the nearest valid Port within a radius.
- [x] **F5.02** Reconnecting: dragging an existing Edge's end to another Port, or off to remove it.
- [x] **F5.03** Dropping a Connection on empty space: `onConnectEnd` with the position in Flow coordinates, so the app can create a Node there.

## F6 — Selection and editing

- [x] **F6.01** Click and modifier-click Selection of Nodes and Edges, clearing on empty space; `select` Batches.
- [x] **F6.02** The selection box (Shift-drag), partial or full overlap.
- [x] **F6.03** Keyboard: arrow keys move the Selection (Shift for bigger steps), Delete / Backspace removes it, Escape cancels a Connection or clears the Selection.
- [x] **F6.04** Copy, cut and paste through the clipboard events (ADR 0022): the payload, new ids, rewritten Edges, placement at the pointer, the app's transforms.
- [x] **F6.05** Dragging from a palette: `<FlowDraggable data>`, `onDrop({ data, position })` (ADR 0022).

## F7 — Accessibility

- [ ] **F7.01** Roving focus over Nodes and Edges in spatial order, `role="application"`, labels the app can override.
- [ ] **F7.02** Connecting by keyboard: Enter on a Port, move to a target Port, Enter again; Escape cancels.
- [ ] **F7.03** A live region announcing moves, Connections, removals and Selection, with messages the app can replace.

## F8 — Server rendering

- [ ] **F8.01** The Flow renders on the server and hydrates: Nodes always, Edges whose ends have declared geometry (ADR 0019); the docs site prerenders a full diagram.

## F9 — Built-in UI

Built from `@solid-slopkit/components` (ADR 0016).

- [ ] **F9.01** `<Background>`: dots, lines and crosses, following the Viewport.
- [ ] **F9.02** `<Controls>`: zoom in, zoom out, fit view, lock interaction.
- [ ] **F9.03** `<MiniMap>`: the Nodes and the visible area, panning and zooming by dragging and clicking in it.

## F10 — Routing

- [ ] **F10.01** The orthogonal router: a sparse grid from Node bounds plus a margin, A* with a bend penalty (ADR 0021). Pure and tested without a DOM.
- [ ] **F10.02** The routed step Edge shape: rerouting the Edges of moved Nodes on each drag frame, within a frame budget measured in a browser test.

## F11 — Layout

- [ ] **F11.01** `@solid-slopkit/flow/layout` with `elkjs` as an optional peer (ADR 0020): Nodes, Ports with sides and Parents into ELK, a Batch of `move` Changes and Edge routes back; the main entry never imports it.
- [ ] **F11.02** Running ELK in a Web Worker, and ELK's routes as the starting routes of routed step Edges until a Node moves.

## F12 — Rendering only visible Nodes

- [ ] **F12.01** The opt-in mode (ADR 0015): culling Nodes and Edges by bounds, keeping last Measured sizes, keeping selected, focused, dragged and connecting Nodes mounted, panning to a Node before focusing it.

## F13 — Release

- [ ] **F13.01** Skills: building an editor, and wiring History and collaboration over Batches. Every area's LLM reference and docs page reviewed against the code.
- [ ] **F13.02** A complete example editor on the docs site that uses every feature, as the acceptance test for 0.0.1.
