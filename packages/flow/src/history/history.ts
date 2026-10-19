import { createSignal } from 'solid-js';

import { invert, type Batch, type Change } from '../changes/changes';

export type HistoryOptions = {
  /** Record Selection Changes too. Off by default: selecting is not an edit to undo. */
  selection?: boolean;
};

export interface History<N = unknown, E = unknown> {
  /** Records a Batch: a one-shot one as its own entry, a gesture's phases as one entry at `end`. */
  record(batch: Batch<N, E>): void;
  /** The Batch that undoes the last entry, to apply; `undefined` when there is none. */
  undo(): Batch<N, E> | undefined;
  /** The Batch that redoes the last undone entry, to apply; `undefined` when there is none. */
  redo(): Batch<N, E> | undefined;
  canUndo(): boolean;
  canRedo(): boolean;
}

// The records a Change touches, as `node:<id>` and `edge:<id>` keys.
function touches(change: Change<unknown, unknown>): string[] {
  switch (change.type) {
    case 'add':
    case 'remove':
      return [...change.nodes.map((node) => `node:${node.id}`), ...change.edges.map((edge) => `edge:${edge.id}`)];
    case 'connect':
      return [`edge:${change.edge.id}`];
    case 'move':
    case 'resize':
    case 'reparent':
      return [`node:${change.node}`];
    case 'reconnect':
      return [`edge:${change.edge}`];
    case 'select':
    case 'update':
      return [`${change.item}:${change.id}`];
  }
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const keys = Object.keys(a).filter((key) => (a as Record<string, unknown>)[key] !== undefined);
  const otherKeys = Object.keys(b).filter((key) => (b as Record<string, unknown>)[key] !== undefined);
  return (
    keys.length === otherKeys.length &&
    keys.every((key) => same((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
  );
}

// `next` folded into `previous` when both set the same thing on the same record: the first `from`, the last `to`.
function fold<N, E>(previous: Change<N, E>, next: Change<N, E>): Change<N, E> | undefined {
  if (previous.type !== next.type || !('from' in previous) || !('from' in next)) return undefined;
  if (previous.type === 'reconnect' && next.type === 'reconnect' && previous.end !== next.end) return undefined;
  if (previous.type === 'update' && next.type === 'update') {
    return { ...previous, from: { ...next.from, ...previous.from }, to: { ...previous.to, ...next.to } } as Change<N, E>;
  }
  return { ...previous, to: next.to } as Change<N, E>;
}

const isNoOp = (change: Change<unknown, unknown>) => 'from' in change && same(change.from, change.to);

/** Adds a Batch's Changes to an entry, folding each into the last earlier Change on the same record when it can. */
function merge<N, E>(entry: Change<N, E>[], changes: readonly Change<N, E>[]) {
  for (const change of changes) {
    const keys = touches(change);
    const last = entry.findLastIndex((earlier) => touches(earlier).some((key) => keys.includes(key)));
    const folded = last === -1 || keys.length !== 1 ? undefined : fold(entry[last]!, change);
    if (folded) entry[last] = folded;
    else entry.push(change);
  }
}

/**
 * Undo and redo stacks of finished Batches, one entry per gesture. The app records the Batches it applies from the Flow,
 * and applies what `undo` and `redo` return (without recording those).
 */
export function createHistory<N = unknown, E = unknown>(options: HistoryOptions = {}): History<N, E> {
  const done: Batch<N, E>[] = [];
  const undone: Batch<N, E>[] = [];
  let gesture: Change<N, E>[] | undefined;
  // The signals only notify readers when a stack empties or fills; the stacks answer, so a read right after
  // `record` or `undo` is current before the next flush.
  const [undoable, setUndoable] = createSignal(false, { name: 'canUndo' });
  const [redoable, setRedoable] = createSignal(false, { name: 'canRedo' });
  const sync = () => {
    setUndoable(done.length > 0);
    setRedoable(undone.length > 0);
  };
  const push = (changes: Change<N, E>[]) => {
    const kept = changes.filter((change) => !isNoOp(change));
    if (kept.length === 0) return;
    done.push({ changes: kept });
    undone.length = 0;
    sync();
  };

  return {
    record(batch) {
      const changes = options.selection ? batch.changes : batch.changes.filter((change) => change.type !== 'select');
      if (batch.phase === undefined) {
        const entry: Change<N, E>[] = [];
        merge(entry, changes);
        push(entry);
        return;
      }
      if (batch.phase === 'start' || !gesture) gesture = [];
      merge(gesture, changes);
      if (batch.phase === 'end') {
        push(gesture);
        gesture = undefined;
      }
    },
    undo() {
      const entry = done.pop();
      if (!entry) return undefined;
      undone.push(entry);
      sync();
      return invert(entry);
    },
    redo() {
      const entry = undone.pop();
      if (!entry) return undefined;
      done.push(entry);
      sync();
      return { changes: [...entry.changes] };
    },
    canUndo: () => (undoable(), done.length > 0),
    canRedo: () => (redoable(), undone.length > 0),
  };
}
