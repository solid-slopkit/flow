# Edges

An `<Edge>` draws one Edge record of the Flow's state (see [model](../model/model.md)) as an SVG path in the Edge layer, under the Nodes, with an optional HTML label in the label layer above them (ADR 0015). The app renders the Edges itself, in the Flow's children, next to its Nodes. Where it sits among them doesn't matter: an Edge renders nothing in place.

```tsx
import { Edge, Flow, Node, Port } from '@solid-slopkit/flow';

<Flow state={flow} onChange={(batch) => applyChanges(setFlow, batch)}>
  <For each={flow.nodes}>
    {(node) => (
      <Node id={node.id}>
        <Port id="in" side="left" />
        {node.data.title}
        <Port id="out" side="right" />
      </Node>
    )}
  </For>
  <For each={flow.edges}>{(edge) => <Edge id={edge.id} markerEnd="arrow-closed" label={edge.data.name} />}</For>
</Flow>;
```

## `<Edge>`

| Prop                       | Type                         | Description                                                                     |
| -------------------------- | ---------------------------- | ------------------------------------------------------------------------------- |
| `id`                       | `string`                     | The record's id. Required; it doesn't change for the life of the Edge.          |
| `shape`                    | `EdgeShapeName \| EdgeShape` | Overrides the record's `shape` (default `bezier`): a name, or a shape function. |
| `markerStart`, `markerEnd` | `EdgeMarker`                 | A marker at that end. None by default.                                          |
| `reconnectable`            | `boolean`                    | Dragging an end moves it to another Port, or removes the Edge. Default `true`.  |
| `label`                    | `JSX.Element`                | HTML centred on the Edge's label point, in the label layer.                     |
| `aria-label`               | `string`                     | Its name for assistive technology; default `messages.edgeLabel`: `From A to B`. |
| `class`, `style`           |                              | On the Edge's `<g class="slp-flow-edge">`.                                      |
| `children`                 | `JSX.Element`                | SVG drawn instead of the default `<EdgePath />`: a custom Edge (see below).     |

- Each end is placed at its Port: the measured point, else the Port declared in the Node's `ports` (see [ports](../port/port.md)). A Floating end (no `port`) is clipped to its Node's outline toward the other end (see [geometry](../geometry/geometry.md)).
- With the Flow's `onlyRenderVisible`, an Edge whose line is out of sight is not drawn either: its `<g>` is empty with `aria-hidden`, and its label box is hidden and empty (see [rendering only visible Nodes](../flow/flow.md#rendering-only-visible-nodes)).
- Nothing is drawn (the `<g>` is empty, no label) until both ends can be placed: both Nodes have a Measured or Declared size, and every named Port is measured or declared. On the server only the declared ones exist (see [server rendering](../flow/flow.md#server-rendering)).
- In an interactive Flow, a wide invisible line along the Edge (`path.slp-flow-edge-hit`) takes clicks, so a click selects it (see [selection](../selection/selection.md)), and each end has an invisible handle (`circle.slp-flow-edge-end`) for reconnecting it, drawn whatever the children (see [connections](../connection/connection.md)).
- Attributes: `data-flow-edge` (the id), `data-selected` and `data-reconnecting` (hidden while an end is dragged) on the `<g>`; `data-flow-edge-label` and `data-selected` on the label.
- Moving a Node redraws only the Edges attached to it.
- Throws outside a Flow.

## Edge shapes

A shape is a function from the two ends to the path and the label point (ADR 0021):

```ts
type EdgeShape = (source: EndPoint, target: EndPoint, context?: EdgeShapeContext) => EdgeGeometry;
type EdgeGeometry = { d: string; label: Point }; // SVG path data, and the label point, in Flow coordinates
interface EdgeShapeContext {
  edge: FlowEdge; // the Edge being drawn
  nodeBounds(id: string): Rect | undefined; // a Node's box, from its Measured else Declared size
  obstacles(): Rect[]; // the boxes to go round: every Node with a size except the Parents of the Edge's ends
}
```

Each `EndPoint` is `{ x, y, side }`: the side says which way the line leaves that end. Only `routed-step` reads `context`; the other built-in shapes ignore it. A shape reading `obstacles()` is redrawn when Nodes move, except during a drag: then only when its own ends move, and once more when the drag ends.

| Name          | Function          | Line                                                                                     |
| ------------- | ----------------- | ---------------------------------------------------------------------------------------- |
| `bezier`      | `bezierShape`     | A cubic curve leaving each end toward its side. The default.                             |
| `straight`    | `straightShape`   | A straight line.                                                                         |
| `step`        | `stepShape`       | Horizontal and vertical runs, leaving each end toward its side, turning halfway.         |
| `smooth-step` | `smoothStepShape` | A step line with rounded corners.                                                        |
| `routed-step` | `routedStepShape` | A step line that goes round the Nodes in its way (see [routing](../routing/routing.md)). |

`edgeShapes` maps each name to its function. They are pure and run on the server. A custom shape is any function of that type:

```tsx
const arc: EdgeShape = (source, target) => {
  const r = Math.hypot(target.x - source.x, target.y - source.y);
  return {
    d: `M ${source.x} ${source.y} A ${r} ${r} 0 0 1 ${target.x} ${target.y}`,
    label: { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 },
  };
};
<Edge id={edge.id} shape={arc} />;
```

## Custom Edges

Children replace the default line. They are SVG, drawn inside the Edge's `<g>`, and read the Edge through `useEdge()`:

| Member                         | Description                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `id()`, `edge()`               | The id, and the record.                                                             |
| `selected()`                   | The record's `selected` flag.                                                       |
| `source()`, `target()`         | The ends' `EndPoint`s in Flow coordinates.                                          |
| `geometry()`                   | The shape's `{ d, label }`.                                                         |
| `markerStart()`, `markerEnd()` | `url(#…)` of the Edge's markers, for a custom path's `marker-start` / `marker-end`. |

Every member is reactive. Children render only while both ends are placed, so `geometry()` is set inside them. `<EdgePath class? style? />` draws the default line (`path.slp-flow-edge-path`) with the markers, to build on:

```tsx
function Flowing() {
  const edge = useEdge();
  return (
    <>
      <EdgePath />
      <circle r="4" fill="currentColor">
        <animateMotion dur="2s" repeatCount="indefinite" path={edge.geometry()?.d} />
      </circle>
    </>
  );
}

<Edge id={edge.id}>
  <Flowing />
</Edge>;
```

`useEdge()` works in the `label` too, and throws outside an Edge.

## Markers

```ts
type EdgeMarker = 'arrow' | 'arrow-closed' | { type: 'arrow' | 'arrow-closed'; size?: number };
```

`size` is in stroke widths (default 8), so a marker grows with the line. Markers are defined inside their Edge (`marker.slp-flow-marker` with `data-marker`), with ids unique on the page, and drawn in `currentColor`: they follow the Edge's color, selected or not. Recolor an Edge with `color` (on `.slp-flow-edge`, or the `style` prop), not `stroke`, so its markers follow.

## Labels

`label` is the app's HTML, so it can hold text, inputs and buttons. It is centred on the shape's label point (the middle of the line for the built-in shapes) in the label layer, above the Nodes, and takes pointer input; pressing it doesn't pan the Flow. Class: `.slp-flow-edge-label`. It has no background of its own.

## Styling

| Selector                | Default                                                                |
| ----------------------- | ---------------------------------------------------------------------- |
| `.slp-flow-edge`        | `color: --slp-flow-edge-color`; selected: `--slp-flow-selection-color` |
| `.slp-flow-edge-path`   | `stroke: currentColor`, `stroke-width: 1.5`, no fill                   |
| `.slp-flow-marker path` | stroked in `currentColor`; `arrow-closed` filled                       |
| `.slp-flow-edge-label`  | centred on the label point, `white-space: nowrap`                      |
| `.slp-flow-edge-hit`    | the click line: transparent, 12 wide, `pointer-events: stroke`         |
| `.slp-flow-edge-end`    | the end handles: transparent, `pointer-events: all`, `cursor: move`    |
