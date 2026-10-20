# Built-in UI

Three components the app adds to a Flow as children, next to its Nodes and Edges: `<Background>`, a pattern behind them that pans and zooms with the Viewport; `<Controls>`, buttons for zooming, fitting the view and locking editing; and `<MiniMap>`, an overview of the whole Flow to pan and zoom with. They are built from `@solid-slopkit/components` (ADR 0016), follow the theme, and render on the server too (see [server rendering](../flow/flow.md#server-rendering)).

```tsx
import { Background, Controls, Edge, Flow, MiniMap, Node } from '@solid-slopkit/flow';

<Flow state={flow} onChange={apply} style={{ height: '600px' }}>
  <Background variant="dots" />
  <Controls />
  <MiniMap />
  <For each={flow.nodes}>{(node) => <Node id={node.id}>{node.data.title}</Node>}</For>
  <For each={flow.edges}>{(edge) => <Edge id={edge.id} />}</For>
</Flow>;
```

Where they are written among the children doesn't matter: each draws into its own layer of the Flow, outside the Viewport's transform. Backgrounds go under the Viewport, in the order they render; Controls and MiniMaps go over it (and over the selection box), each in a corner.

## `<Background>`

An `svg.slp-flow-background` that fills the Flow, with an SVG pattern repeated every `gap` in Flow coordinates, so it moves and scales with the Viewport. A grid point sits at every multiple of `gap` (plus `offset`), Flow coordinates `(0, 0)` included. It takes no pointer events: dragging it pans, as on any empty space, and it is `aria-hidden`.

| Prop             | Type                           | Default                    | Description                                                                            |
| ---------------- | ------------------------------ | -------------------------- | -------------------------------------------------------------------------------------- |
| `variant`        | `'dots' \| 'lines' \| 'cross'` | `'dots'`                   | A dot, two lines crossing the tile, or a small cross at each grid point.               |
| `gap`            | `number \| [number, number]`   | `20`                       | The spacing in Flow coordinates; `[x, y]` for different spacings.                      |
| `size`           | `number`                       | `2` dots, `6` cross        | In Flow coordinates: a dot's diameter, or a cross's width and height. Lines ignore it. |
| `lineWidth`      | `number`                       | `1`                        | Lines' and crosses' stroke width, in screen pixels.                                    |
| `offset`         | `number \| [number, number]`   | `0`                        | Shifts the grid, in Flow coordinates.                                                  |
| `color`          | `string`                       | `--slp-flow-pattern-color` | The pattern's color.                                                                   |
| `class`, `style` |                                |                            | On the `svg`; it has `data-variant`.                                                   |

Several Backgrounds stack, the first lowest: fine lines under coarse ones make a grid with major lines.

```tsx
<Background variant="lines" gap={20} color="var(--slp-color-base-200)" />
<Background variant="lines" gap={100} />
```

## `<Controls>`

A `div.slp-flow-controls`, `role="group"`, named by `messages.controls`, with `ActionIcon` buttons from `@solid-slopkit/components`:

| Button       | Name               | Does                                                                                |
| ------------ | ------------------ | ----------------------------------------------------------------------------------- |
| zoom in      | `messages.zoomIn`  | `useFlow().zoomIn()`: × 1.2 around the Flow's centre, within `maxZoom`.             |
| zoom out     | `messages.zoomOut` | `useFlow().zoomOut()`, within `minZoom`.                                            |
| fit view     | `messages.fitView` | `useFlow().fitView(fitViewOptions)`.                                                |
| lock editing | `messages.lock`    | Toggles `useFlow().setLocked(…)`; `aria-pressed` and the pressed look while locked. |

| Prop             | Type                         | Default             | Description                                                     |
| ---------------- | ---------------------------- | ------------------- | --------------------------------------------------------------- |
| `position`       | `PanelPosition`              | `'bottom-left'`     | `'top-left' \| 'top-right' \| 'bottom-left' \| 'bottom-right'`. |
| `orientation`    | `'vertical' \| 'horizontal'` | `'vertical'`        | How the buttons line up.                                        |
| `showZoom`       | `boolean`                    | `true`              | The zoom in and zoom out buttons.                               |
| `showFitView`    | `boolean`                    | `true`              | The fit view button.                                            |
| `showLock`       | `boolean`                    | `true`              | The lock button.                                                |
| `fitViewOptions` | `FitViewOptions`             |                     | What fit view fits (`nodes`) and its `padding`.                 |
| `aria-label`     | `string`                     | `messages.controls` | The group's name.                                               |
| `class`, `style` |                              |                     | On the group.                                                   |
| `children`       | `JSX.Element`                |                     | More buttons after the built-in ones, usually `ActionIcon`s.    |

**Locking** is the Flow's own state, like an uncontrolled Viewport: `useFlow().locked()` and `setLocked(locked)`. While locked, `interactive()` is `false`, so the Flow is read-only as with `interactive={false}`: no Batches, no dragging, no Connections, but panning and zooming still work. The app's `interactive={false}` stays read-only whatever the lock says.

```tsx
// `history` and `undo` as in history.md. Inside the Flow, so useFlow() works.
function UndoButton() {
  const flow = useFlow();
  return (
    <ActionIcon label="Undo" size="sm" disabled={!history.canUndo() || flow.locked()} onClick={undo}>
      ↶
    </ActionIcon>
  );
}

<Controls position="top-right" orientation="horizontal" showLock={false}>
  <UndoButton />
</Controls>;
```

## `<MiniMap>`

A `div.slp-flow-minimap` holding an `svg` of `width` × `height` pixels that shows, in Flow coordinates, every Node with a size (its Measured else Declared size, at its absolute position) and the visible area, centred and scaled to fit with 8px to spare. Outside the visible area it is shaded. A Node without a size isn't drawn; without a Flow size (not measured, no `width` and `height`), neither is the visible area.

- **Pointer:** dragging pans the Flow so the visible area follows the pointer. A press outside the visible area first centres the view on that point. The wheel zooms around the Flow's centre, not the Flow's own wheel zoom around the pointer.
- **Keyboard:** the `svg` takes focus (it comes after Controls in the Flow's Tab order, see [accessibility](../accessibility/accessibility.md)). The arrow keys pan by a tenth of the visible area, `+` (or `=`) and `-` zoom in and out. `messages.miniMapInstructions` says so, as its description.
- It is `role="img"`, named by `messages.miniMap`. Neither `pannable` nor `zoomable`: a picture only, with no `tabindex` and no description.
- Moving one Node re-renders only its rectangle; panning re-renders the visible area and the view box.

| Prop              | Type                                      | Default                         | Description                                         |
| ----------------- | ----------------------------------------- | ------------------------------- | --------------------------------------------------- |
| `position`        | `PanelPosition`                           | `'bottom-right'`                | Its corner.                                         |
| `width`, `height` | `number`                                  | `200`, `150`                    | In pixels.                                          |
| `nodeColor`       | `string \| (node) => string \| undefined` | `--slp-flow-minimap-node-color` | Each Node's fill, as an inline style.               |
| `nodeClass`       | `string \| (node) => string \| undefined` |                                 | A class for each Node's rectangle.                  |
| `pannable`        | `boolean`                                 | `true`                          | Dragging, clicking and the arrow keys pan the Flow. |
| `zoomable`        | `boolean`                                 | `true`                          | The wheel and `+` / `-` zoom the Flow.              |
| `aria-label`      | `string`                                  | `messages.miniMap`              | Its name.                                           |
| `class`, `style`  |                                           |                                 | On the `div`.                                       |

```tsx
<MiniMap
  position="top-right"
  width={160}
  height={100}
  nodeColor={(node) => (node.data.failed ? 'var(--slp-color-error)' : undefined)}
/>
```

## Panels and the Flow's input

Controls and MiniMaps are panels: `.slp-flow-panel[data-flow-panel][data-position]`, absolutely placed in their corner with a margin of three spacing units, on `--slp-flow-panel-background` with a border and a small shadow. Two panels in the same corner overlap; move one with `style` or another `position`.

Input on a panel is the panel's own. A press on one neither pans the Flow nor changes the Selection, and keys and clipboard events in one never reach the Selection: Delete on a focused Controls button removes nothing, and the arrow keys over the MiniMap pan instead of moving Nodes.

## Styling

| Selector or variable            | What it is                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `.slp-flow-background`          | a Background: `color` is the pattern's, `--slp-flow-pattern-color` by default   |
| `.slp-flow-panel`               | a Controls or MiniMap panel; `data-position` is its corner                      |
| `.slp-flow-controls`            | Controls: a flex column, or a row with `data-orientation="horizontal"`          |
| `.slp-flow-minimap svg`         | the MiniMap; `data-pannable` while it pans; a focus ring for keyboard focus     |
| `.slp-flow-minimap-node`        | a Node's rectangle: `data-flow-minimap-node` is its id, `data-selected` when so |
| `.slp-flow-minimap-mask`        | the shade outside the visible area                                              |
| `.slp-flow-minimap-view`        | the visible area's outline, in the selection color                              |
| `--slp-flow-panel-background`   | the panels' surface; default `--slp-color-base-100`                             |
| `--slp-flow-minimap-node-color` | Nodes in the MiniMap; default `--slp-color-base-300`                            |
| `--slp-flow-minimap-mask-color` | the shade; default `--slp-color-base-content` at 8%                             |
