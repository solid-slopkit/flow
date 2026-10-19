# Changes and Batches

Every edit the Flow proposes arrives as a `Batch` of `Change`s through one `onChange(batch)`. The app decides what to apply; `applyChanges` applies a Batch to its store. Every Change carries the value it replaces, so `invert(batch)` needs nothing else, which is what [history](../history/history.md) builds on.

```ts
type Batch<N, E> = { phase?: 'start' | 'update' | 'end'; changes: Change<N, E>[] };
```

A continuous gesture (a drag, a resize) sends Batches in phases: `start`, any number of `update`s, `end`. Every update goes through the app, so other clients can follow a drag live. A Batch without `phase` is a one-shot edit. Changes in a Batch apply in order.

## Changes

| `type`      | Fields                                                                                    | Inverse           |
| ----------- | ----------------------------------------------------------------------------------------- | ----------------- |
| `add`       | `nodes`, `edges` (whole records), `at?: Indices`                                          | `remove`          |
| `remove`    | `nodes`, `edges` (whole records), `at?: Indices`                                          | `add`             |
| `connect`   | `edge`: the new Edge from a Connection                                                    | `remove` the Edge |
| `move`      | `node`, `from: Point`, `to: Point`                                                        | `from` ↔ `to`     |
| `select`    | `item: 'node' \| 'edge'`, `id`, `from: boolean`, `to: boolean`                            | `from` ↔ `to`     |
| `resize`    | `node`, `from` / `to`: `{ position: Point; size?: Size }`                                 | `from` ↔ `to`     |
| `reconnect` | `edge`, `end: 'source' \| 'target'`, `from: End`, `to: End`                               | `from` ↔ `to`     |
| `reparent`  | `node`, `from` / `to`: `{ parent?: string; position: Point }`                             | `from` ↔ `to`     |
| `update`    | `item: 'node' \| 'edge'`, `id`, `from` / `to`: other fields (`NodeFields` / `EdgeFields`) | `from` ↔ `to`     |

Each has its own type: `AddChange`, `RemoveChange`, `ConnectChange`, `MoveChange`, `SelectChange`, `ResizeChange`, `ReconnectChange`, `ReparentChange`, `UpdateChange`.

- `resize` sets the Declared size and, when resized from the top or left, the position. A `to` without `size` removes the Declared size.
- `reparent` carries the position relative to the new Parent, so the Node stays where it is on screen. A `to` without `parent` makes it top-level.
- `update` sets each field in `to`; a field present with `undefined` is removed. `from` holds the same keys with their old values.
- `select` with `to: false` clears the flag; an unset `selected` reads as `false`.
- `Indices` (`{ nodes: number[]; edges: number[] }`) are where each record sat in the lists, ascending, in the order of the Change's records. An `add` with `at` inserts the records there instead of at the end, so undoing a removal restores the order.

## `invert(batch)`

The one-shot Batch that undoes `batch`: each Change's Inverse, in reverse order, without a phase. `applyChanges(setFlow, batch)` then `applyChanges(setFlow, invert(batch))` leaves the state as it was.

## `applyChanges(setFlow, batch)`

Applies a Batch with the store's setter, in one store write. It mutates the store in place, field by field, so a `move` re-runs only what reads that Node's position. Records and values are copied into the store, never adopted, so the Batch stays valid for History. Changes naming a record that isn't there are skipped.

```ts
const [flow, setFlow] = createStore<FlowState<Task, null>>({ nodes: [], edges: [] });
const onChange = (batch: Batch<Task, null>) => applyChanges(setFlow, batch);
```

Removing a Node also removes the Nodes nested in it and the Edges at any of them. A `remove` Change listing only the Node can't put those back on undo, so build removals with `removal`.

## `removal(state, { nodes?, edges? })`

The complete `remove` Change for these ids: every Node nested in a removed Node and every Edge at a removed Node, copied from the state, with `at` set to where each one sat.

```ts
applyChanges(setFlow, { changes: [removal(flow, { nodes: ['group'] })] });
```
