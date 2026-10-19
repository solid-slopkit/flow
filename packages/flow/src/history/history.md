# History

Undo and redo over Batches (see [changes](../changes/changes.md)): one entry per gesture, undone by the entry's Inverse. No snapshots, so memory grows with the edits, not with the Flow, and undoing never overwrites concurrent remote edits to other records.

```ts
import { applyChanges, createHistory, type Batch } from '@solid-slopkit/flow';

const history = createHistory<Task, null>();

function onChange(batch: Batch<Task, null>) {
  applyChanges(setFlow, batch);
  history.record(batch);
}
const undo = () => {
  const batch = history.undo();
  if (batch) applyChanges(setFlow, batch); // not recorded
};
const redo = () => {
  const batch = history.redo();
  if (batch) applyChanges(setFlow, batch);
};

<button disabled={!history.canUndo()} onClick={undo}>Undo</button>;
```

## `createHistory(options?)`

| Member          | What it does                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `record(batch)` | A Batch without a phase becomes one entry. A gesture's `start`, `update`s and `end` become one entry at `end`. Recording clears redo. |
| `undo()`        | Moves the last entry to redo and returns its Inverse to apply, or `undefined`.                                                        |
| `redo()`        | Moves the last undone entry back and returns it to apply, or `undefined`.                                                             |
| `canUndo()`     | Whether there is an entry to undo. Reactive: readers re-run only when it flips.                                                       |
| `canRedo()`     | Whether there is an entry to redo. Reactive in the same way.                                                                          |

`options.selection: true` records Selection Changes too. By default they are dropped, and a Batch with nothing else isn't recorded.

- Within an entry, a Change folds into the last earlier Change on the same record when both are the same kind (`move` into `move`, `reconnect` of the same end, …): the first `from` and the last `to`. A whole drag becomes one `move` per Node. A different Change on that record in between keeps them apart, so the order still undoes correctly.
- Changes whose `from` equals their `to` after folding are dropped; a drag that ends where it started isn't recorded.
- Record only the Batches the user made here. Don't record what `undo` and `redo` return, or Batches from other clients.
