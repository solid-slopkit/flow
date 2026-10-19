# Geometry

Pure functions from the data (see [model](../model/model.md)) to absolute Flow coordinates. They never touch the DOM, so they run on the server. Each takes a `FlowIndex` from `indexFlow(state)`; those that need sizes take an optional `measured` lookup, and use the Measured size where it has one, else the Node's Declared `size`. Those that place Ports take an optional `ports` lookup, and use a measured Port where it has one, else the Port declared in the Node's `ports`.

```ts
type MeasuredSizes = (node: string) => Size | undefined;
type EndPoint = Point & { side: Side }; // where an Edge end sits, and which way it leaves
type MeasuredPorts = (node: string, port: string) => EndPoint | undefined; // relative to the Node's top-left corner
```

| Function                                   | Returns                                                                                                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `absolutePosition(index, id)`              | The Node's position plus all its Parents'. `undefined` for an unknown id.                                                                                                                                                                                                |
| `nodeBounds(index, id, measured?)`         | The Node's `Rect` at its absolute position. `undefined` without a Measured or Declared size.                                                                                                                                                                             |
| `portPoint(index, end, measured?, ports?)` | The `EndPoint` of a Port: measured, at the Node's absolute position; else declared in the Node's `ports`, on its `side`, `offset` along it (default `0.5`). `undefined` for a Floating end, a Port neither measured nor declared, or a declared Port on an unsized Node. |
| `floatingPoint(bounds, toward)`            | Where the line from the box's centre toward `toward` crosses its outline, with the side it crosses.                                                                                                                                                                      |
| `edgeEnds(index, edge, measured?, ports?)` | `{ source, target }` `EndPoint`s. A Floating end is clipped toward the other end's Port point, or the other Node's centre. `undefined` while either Node has no size or a named Port is neither measured nor declared.                                                   |

- A `parent` naming a missing Node, or one that closes a cycle, ends the walk up the Parents there.
- Inside a memo these only read what they use: `edgeEnds` re-runs when a Node at one of its ends moves or resizes, not when another Node does.

```ts
const index = createMemo(() => indexFlow(flow));
const ends = createMemo(() => edgeEnds(index(), edge, measured));
```
