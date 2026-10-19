// Every edit the Flow proposes, as data the app applies (ADR 0014). Each Change carries the value it replaces, so its
// Inverse needs nothing else.
import type { End, FlowEdge, FlowNode, Point, Size } from '../model/model';

/** Where a continuous gesture is. A Batch without a phase is a one-shot edit. */
export type Phase = 'start' | 'update' | 'end';

/** Where each record sits in `nodes` and `edges`, in the same order as the Change's records and ascending. */
export type Indices = { nodes: number[]; edges: number[] };

/** Records to add, at the end of the lists, or inserted at `at` (the Inverse of a removal puts them back). */
export type AddChange<N = unknown, E = unknown> = { type: 'add'; nodes: FlowNode<N>[]; edges: FlowEdge<E>[]; at?: Indices };

/** Records to remove, carried whole so the Inverse can add them back, at `at` when it is set. */
export type RemoveChange<N = unknown, E = unknown> = {
  type: 'remove';
  nodes: FlowNode<N>[];
  edges: FlowEdge<E>[];
  at?: Indices;
};

/** A Node's `position`. */
export type MoveChange = { type: 'move'; node: string; from: Point; to: Point };

/** A Node's or an Edge's `selected` flag; unset reads as `false`. */
export type SelectChange = { type: 'select'; item: 'node' | 'edge'; id: string; from: boolean; to: boolean };

/** A Node's Declared `size`, and its `position` when resized from the top or left. An unset size is removed. */
export type ResizeChange = {
  type: 'resize';
  node: string;
  from: { position: Point; size?: Size };
  to: { position: Point; size?: Size };
};

/** A new Edge from a finished Connection. */
export type ConnectChange<E = unknown> = { type: 'connect'; edge: FlowEdge<E> };

/** One end of an Edge moved to another Node or Port. */
export type ReconnectChange = { type: 'reconnect'; edge: string; end: 'source' | 'target'; from: End; to: End };

/** A Node's `parent`, and its `position`, now relative to the new Parent. An unset parent makes it top-level. */
export type ReparentChange = {
  type: 'reparent';
  node: string;
  from: { parent?: string; position: Point };
  to: { parent?: string; position: Point };
};

/** Fields of a record other than its id. In an `update`, a field present but `undefined` is removed. */
export type NodeFields<N = unknown> = Partial<Omit<FlowNode<N>, 'id'>>;
export type EdgeFields<E = unknown> = Partial<Omit<FlowEdge<E>, 'id'>>;

/** Any other fields of one record, such as its `data`; `from` holds the same keys as `to`, with their old values. */
export type UpdateChange<N = unknown, E = unknown> =
  | { type: 'update'; item: 'node'; id: string; from: NodeFields<N>; to: NodeFields<N> }
  | { type: 'update'; item: 'edge'; id: string; from: EdgeFields<E>; to: EdgeFields<E> };

/** One edit the Flow proposes to the app's data. */
export type Change<N = unknown, E = unknown> =
  | AddChange<N, E>
  | RemoveChange<N, E>
  | MoveChange
  | SelectChange
  | ResizeChange
  | ConnectChange<E>
  | ReconnectChange
  | ReparentChange
  | UpdateChange<N, E>;

/** The Changes one gesture produces at one moment, applied together in order. */
export type Batch<N = unknown, E = unknown> = { phase?: Phase; changes: Change<N, E>[] };

function invertChange<N, E>(change: Change<N, E>): Change<N, E> {
  switch (change.type) {
    case 'add':
      return { ...change, type: 'remove' };
    case 'remove':
      return { ...change, type: 'add' };
    case 'connect':
      return { type: 'remove', nodes: [], edges: [change.edge] };
    case 'move':
    case 'select':
    case 'resize':
    case 'reconnect':
    case 'reparent':
    case 'update':
      return { ...change, from: change.to, to: change.from } as Change<N, E>;
  }
}

/** The one-shot Batch that undoes a Batch: each Change's Inverse, in reverse order. */
export function invert<N, E>(batch: Batch<N, E>): Batch<N, E> {
  return { changes: batch.changes.map(invertChange).reverse() };
}
