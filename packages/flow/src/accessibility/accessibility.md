# Accessibility

A Flow works from the keyboard and tells a screen reader what it is and what happens in it: focus moves over the Nodes, Ports and Edges in spatial order, a Connection can be made without a pointer, and a live region announces every edit the Flow sends. Every string involved comes from `messages`, a Flow prop, so the app can word or translate them.

## Roles and names

| Element                | Role          | `aria-roledescription` | Name (`aria-label`)                                                                   |
| ---------------------- | ------------- | ---------------------- | ------------------------------------------------------------------------------------- |
| the Flow (`.slp-flow`) | `application` |                        | the Flow's `aria-label`, else `messages.flow` (`Flow`)                                |
| a `<Node>`             | `group`       | `messages.node`        | the Node's `aria-label`, else its text content, else its id                           |
| a `<Port>`             | `button`      | `messages.port`        | the Port's `aria-label`, else `messages.portLabel({ port, node })`: `out on Start`    |
| an `<Edge>`            | `group`       | `messages.edge`        | the Edge's `aria-label`, else `messages.edgeLabel({ source, target })`: `From A to B` |

- The Flow is described (`aria-describedby`) by `messages.instructions`, a visually hidden text saying how its keyboard works, so a screen reader reads it when the Flow gets focus.
- A Node's name is its text content with whitespace collapsed, read when it is measured and whenever its text changes. Give it an `aria-label` when its text is long or says nothing on its own (an icon, a number). The same name is used in Edge names and announcements.
- A Port in a read-only Flow has `aria-disabled="true"`.
- An Edge that isn't drawn yet (an end without geometry) has no `tabindex`, so it takes no focus.

```tsx
<Flow state={flow} onChange={apply} aria-label="Billing pipeline">
  <For each={flow.nodes}>
    {(node) => (
      <Node id={node.id} aria-label={node.data.title}>
        <Port id="in" side="left" aria-label={`Input of ${node.data.title}`} />…
      </Node>
    )}
  </For>
  <For each={flow.edges}>{(edge) => <Edge id={edge.id} />}</For>
</Flow>
```

## Focus

The Flow's root is its one stop in the page's Tab order (`tabindex="0"`). Nodes, Ports and Edges have `tabindex="-1"`: they take focus from a click, and from Tab and Shift+Tab while focus is in the Flow, which move through them in this order:

1. Each Node in spatial order: top-level Nodes by their top edge, then their left edge, each followed by the Nodes nested in it (ordered the same way). Ties keep state order.
2. After each Node, what can take focus inside it, in page order: its Ports and the app's own controls (inputs, buttons, links).
3. Then the Edges, ordered by where their Source comes, then their Target.
4. Then the built-in UI over the Flow, `<Controls>` and `<MiniMap>`, in page order (see [built-in UI](../ui/ui.md)).

| Key            | Where             | Does                                                                                    |
| -------------- | ----------------- | --------------------------------------------------------------------------------------- |
| Tab            | the Flow itself   | focuses the last item focused in the Flow, else the first                               |
| Tab            | an item           | focuses the next; from the last, the first focusable element after the Flow in the page |
| Shift+Tab      | an item           | focuses the previous; from the first, the Flow itself                                   |
| Shift+Tab      | the Flow itself   | the page's own: focus leaves the Flow                                                   |
| Space or Enter | a Node or an Edge | selects it alone; with Shift, Ctrl or Meta, adds it to the Selection or takes it out    |

- Focus is not the Selection. The arrow keys and Delete act on the Selection (see [selection](../selection/selection.md)), so select a focused Node with Space before moving it.
- Focusing an item from the keyboard pans the Viewport to centre it when it isn't wholly in sight. The Flow's root clips its content (`overflow: clip`), so focus never scrolls it.
- With `onlyRenderVisible` (see [rendering only visible Nodes](../flow/flow.md#rendering-only-visible-nodes)), the order still covers every Node, Port and Edge, rendered or not: Tab to one out of sight centres the Viewport on it and renders it before focusing it, and it stays rendered while it has focus. Nodes out of sight are not in the page, so a screen reader's own reading commands don't reach them; that is why the mode is off by default.
- Removing the focused Node or Edge with Delete, Backspace or cut moves focus to the Flow itself, so the keyboard keeps working.
- Keys typed in an `input`, `textarea`, `select` or editable content are the field's, except Tab. So are keys pressed in built-in UI (`[data-flow-panel]`): arrow keys over the MiniMap pan, and Delete on a Controls button removes nothing.

## Connecting from the keyboard

| Key                            | Does                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Enter on a focused Port        | starts a Connection from it, when it may start there (see [connections](../connection/connection.md)) |
| Tab, Shift+Tab, the arrow keys | while connecting: focus the next or previous Port it may end on, round the ends                       |
| Enter on a Port it may end on  | sends one `connect` Batch, as dropping it there would                                                 |
| Escape                         | cancels; focus goes back to the starting Port                                                         |

- The Ports it may end on are decided when it starts, by Port kinds, `max` and `canConnect`, as for a dragged Connection. Only rendered `<Port>`s take focus.
- While it lasts, `useFlow().connection()` reports it and the preview line is drawn: a short stub out of the starting Port, then to the focused Port it may end on (`data-valid`, and `data-connection-target` on that Port).
- Focus leaving the Flow, or a press anywhere in it, cancels it. Enter with no Port it may end on focused does nothing.
- A read-only Flow starts no Connection.

## Announcements

`div.slp-flow-live`, a visually hidden `role="status"` region (polite) inside the Flow, says what each Batch the Flow sends does, as the Flow proposes it, before the app applies it. A gesture in phases (a drag, the selection box) is announced once, at its `end`, from all its Changes. Each Batch says one thing, by priority:

| Changes in the Batch | Message                                    | Default                                             |
| -------------------- | ------------------------------------------ | --------------------------------------------------- |
| `remove`             | `removed({ nodes: names, edges: count })`  | `Removed Start and 2 edges`                         |
| `add` (a paste)      | `added({ nodes: count, edges: count })`    | `Added 2 nodes and 1 edge`                          |
| `connect`            | `connected({ source, target })`            | `Connected Start to End`                            |
| `reconnect`          | `reconnected({ source, target })`          | `Edge now runs from Start to Other`                 |
| `move`               | `moved({ nodes: names, position })`        | `Moved Start to 120, 40`, or `Moved Start and End`  |
| `select`             | `selected({ nodes: names, edges: count })` | `Selected Start and 1 edge`, or `Selection cleared` |

Starting and cancelling a keyboard Connection say `messages.connecting({ port, node, targets })` and `messages.connectionCancelled`. Names are Node names as above; more than three are counted (`4 nodes`). Batches sent through `useFlow().emit` are announced too; edits the app makes to its state directly are not, and a read-only Flow announces nothing.

## `messages`

```ts
interface FlowMessages {
  flow: string;
  instructions: string;
  node: string;
  edge: string;
  port: string;
  edgeLabel(edge: { source: string; target: string }): string;
  portLabel(port: { port: string; node: string }): string;
  moved(move: { nodes: string[]; position: Point }): string;
  connected(edge: { source: string; target: string }): string;
  reconnected(edge: { source: string; target: string }): string;
  removed(removal: { nodes: string[]; edges: number }): string;
  added(addition: { nodes: number; edges: number }): string;
  selected(selection: { nodes: string[]; edges: number }): string;
  connecting(connection: { port: string; node: string; targets: number }): string;
  connectionCancelled: string;
  // Built-in UI (see ui.md)
  controls: string; // 'Flow controls'
  zoomIn: string; // 'Zoom in'
  zoomOut: string; // 'Zoom out'
  fitView: string; // 'Fit view'
  lock: string; // 'Lock editing'
  miniMap: string; // 'Mini map'
  miniMapInstructions: string;
}
```

The Flow's `messages` prop takes any of these (`Partial<FlowMessages>`) over the English defaults. A message function returning `''` announces nothing.

```tsx
<Flow
  state={flow}
  onChange={apply}
  messages={{
    flow: 'Diagramm',
    moved: ({ nodes }) => `${nodes.join(', ')} verschoben`,
    selected: () => '', // quiet
  }}
/>
```

## Styling

| Selector                       | What it is                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `.slp-flow:focus-visible`      | the Flow itself: a 2 px inset outline in `--slp-flow-selection-color`            |
| `.slp-flow-node:focus-visible` | a 2 px outline 4 px out, the selection color at 50%; selected too, 3 px          |
| `.slp-flow-port:focus-visible` | a 2 px outline 2 px out in the selection color                                   |
| `.slp-flow-edge:focus-visible` | a halo along the Edge (its hit line, 35% of the selection color) and a 3 px line |

Rings show only for keyboard focus; a click focuses without one. Moving focus re-runs nothing, an announcement re-runs only the live region's text, and moving between the Ports a keyboard Connection may end on re-runs only the two Ports' marks and the preview line.
