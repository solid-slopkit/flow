# Routing

The `routed-step` Edge shape draws horizontal and vertical runs that go round the Nodes in the Edge's way (ADR 0021). It is routed by `routeOrthogonal`, a router in this package: pure, synchronous, and fast enough to reroute on every drag frame. The other shapes (see [edges](../edge/edge.md)) are not routed.

```tsx
const edge: FlowEdge = {
  id: 'ab',
  source: { node: 'a', port: 'out' },
  target: { node: 'b', port: 'in' },
  shape: 'routed-step',
  data,
};
// or, whatever the record says:
<Edge id={edge.id} shape="routed-step" />;
```

## Routed step Edges

- While the Edge's `route` (a Layout's, see [layout](../layout/layout.md)) still joins its ends and crosses no Node, it is drawn as is.
- Otherwise, while the plain step line (`step`) crosses no Node, it is that line. Failing both, it goes round the Nodes in its way, 20 Flow units from them where there is room, with as few bends as it can; when no route exists it falls back to the plain step line.
- It leaves each end toward its Port's side, as `step` does, and Floating ends work the same.
- It goes round every Node with a Measured or Declared size, except the Parents of its two ends (a Node it is drawn inside). Its own two Nodes are obstacles too: a route never crosses them, though it may run along their outline. A Node with an end inside its box is ignored.
- When it is redrawn: when its own ends move, and when any Node moves or is resized, except during a drag. While Nodes are dragged, only the Edges whose ends move (the Edges of the dragged Nodes and of their children) are rerouted on each frame; every other routed Edge keeps its route until the drag ends, then is rerouted once.
- `routedStepShape` is the shape function. It reads `context.obstacles()` (see [Edge shapes](../edge/edge.md#edge-shapes)), and without a `context` it is the plain step line. It runs on the server, from Declared sizes.
- The label point is halfway along the route.

## `routeOrthogonal`

The router, for a shape of the app's own (rounded corners, another margin):

```ts
function routeOrthogonal(
  source: EndPoint,
  target: EndPoint,
  obstacles: readonly Rect[],
  options?: RouteOptions,
): Point[] | undefined;

interface RouteOptions {
  margin?: number; // how far a route keeps from the obstacles, in Flow units; default 20
  bendPenalty?: number; // what one bend costs, in Flow units of length; default 40
  prefer?: readonly Point[]; // returned as is (corners only) when it crosses no obstacle
}
```

- Returns the route's corners from `source` to `target`, both included, every run horizontal or vertical and every corner a turn; `undefined` when no route exists.
- The first run leaves `source` toward its side; the last enters `target` from its side. It never turns back on itself.
- The route is the shortest, counting each bend as `bendPenalty` of extra length: an A\* search over a sparse grid whose lines run along every obstacle plus `margin`, through both ends, and halfway between them.
- Obstacles are their open interiors: a route may run along an outline, never inside. An obstacle with an end inside it is ignored. One with an end within `margin` of it (the end's own Node) is kept at no distance instead. When no route keeps the margin, a route that only stays out of the obstacles themselves is searched for.
- Only obstacles that could be in the way are searched: those around the ends, and those touching them in turn. Far away Nodes cost nothing.
- Pure, with no DOM. It runs on the server.

```tsx
import { routeOrthogonal, stepShape, type EdgeShape } from '@solid-slopkit/flow';

const roomy: EdgeShape = (source, target, context) => {
  const points = context && routeOrthogonal(source, target, context.obstacles(), { margin: 40 });
  if (!points) return stepShape(source, target);
  return { d: `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')}`, label: points[Math.floor(points.length / 2)]! };
};
<Edge id={edge.id} shape={roomy} />;
```
