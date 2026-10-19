# Ports

A Port is a point on a Node where Edges attach. Render `<Port>` inside a `<Node>`'s content. Its id is unique within its Node only, so Node templates reuse names like `"in"` and `"out"`.

```tsx
import { Node, Port } from '@solid-slopkit/flow';

<Node id={node.id} class="card">
  <Port id="in" side="left" kind="target" max={1} />
  <h3>{node.data.title}</h3>
  <Port id="out" side="right" kind="source" />
</Node>;
```

## `<Port>`

| Prop             | Type          | Default                              | Description                                                                                                                                               |
| ---------------- | ------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | `string`      | required                             | Unique within the Node. It doesn't change for the life of the Port.                                                                                       |
| `side`           | `Side`        | the declared side, else nearest side | Which side it sits on, and which way its Edges leave.                                                                                                     |
| `offset`         | `number`      | the declared offset, else `0.5`      | Where along the side, as a fraction from its top or left corner.                                                                                          |
| `kind`           | `PortKind`    | the declared kind, else `both`       | Which Edge ends it accepts: `source`, `target` or `both`.                                                                                                 |
| `max`            | `number`      | the declared `max`, else unlimited   | The most Edges it accepts.                                                                                                                                |
| `aria-label`     | `string`      | `messages.portLabel`: `out on Start` | Its name for assistive technology. It is a focusable `role="button"`: Enter starts a Connection (see [accessibility](../accessibility/accessibility.md)). |
| `class`, `style` |               |                                      | On the Port element (`.slp-flow-port`).                                                                                                                   |
| `children`       | `JSX.Element` |                                      | Content inside the Port element.                                                                                                                          |

- "Declared" means the `PortSpec` with the same id in the Node's `ports` (see [model](../model/model.md)). Props win over it.
- With a `side`, the stylesheet centres the Port on that side of the Node, `offset` along it. Without one, the app positions it (it is `position: absolute`), and it takes the side of the Node it ends up nearest to. Place Ports directly in the Node, or in a wrapper that isn't positioned, so they are placed against the Node's box.
- Attributes: `data-flow-port` (the id), `data-flow-port-side`, `data-flow-port-kind`; `data-connectable` in an interactive Flow, `data-connecting` while a Connection is drawn from it, `data-connection-target` while one snaps to it. Any element with `data-flow-port` inside a Node is measured as a Port too; `<Port>` adds placement, defaults from the declaration, and `useFlow().port()`.
- Throws outside a Node.

## Connecting

Pressing a Port and dragging starts a Connection, and never drags the Node; dropping it on another Port makes an Edge. The Port's kind and `max`, then the Flow's `canConnect`, decide where a Connection may end. See [connections](../connection/connection.md).

## Measured and declared Ports

The Flow measures each Port's centre relative to its Node (see [nodes](../node/node.md)), when it first renders, when it or its Node resizes, and when its `side` or `offset` changes. Edges attach to the measured point. Until a Port is measured (on the server, or before the Node is laid out), an Edge uses the Port declared in the Node's `ports`, placed from the Node's Declared size (ADR 0019). An Edge naming a Port that is neither measured nor declared isn't drawn.

- `useFlow().measuredPort(node, port)`: the measured `{ x, y, side }`, relative to the Node. Reactive.
- `useFlow().port(node, port)`: a `PortInfo`, `{ side, kind, max }`, from the rendered `<Port>`, else from the declaration; `undefined` for neither. Its fields are reactive.

## Styling

`.slp-flow-port` is an 8 px dot in `--slp-flow-port-color`, with a crosshair cursor in an interactive Flow; the Port a Connection snaps to grows and takes `--slp-flow-selection-color`. Override its size, shape and color with ordinary CSS on the class, or with `class` and `style`.
