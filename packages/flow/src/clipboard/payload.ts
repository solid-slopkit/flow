// What copy writes and paste reads (ADR 0022): whole records, without Selection, positioned so they stand on their own.
// Pure: no DOM.
import { absolutePosition } from '../geometry/geometry';
import type { FlowIndex } from '../model/flow-index';
import type { FlowEdge, FlowNode, FlowState, Point } from '../model/model';

/** The clipboard's custom type; plain-text JSON is written next to it. */
export const CLIPBOARD_TYPE = 'application/x-slopkit-flow+json';

/** Nodes and the Edges among them, as copied, pasted and transformed. */
export type ClipboardPayload<N = unknown, E = unknown> = { nodes: FlowNode<N>[]; edges: FlowEdge<E>[] };

/** Records are copied through JSON: the clipboard holds JSON, and the copy shares nothing with the app's store. */
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * The selected Nodes with every Node nested in them, and the Edges between two of those. A Node whose Parent isn't
 * copied becomes top-level at its absolute position. `undefined` when no Node is selected.
 */
export function copyPayload<N, E>(state: FlowState<N, E>, index: FlowIndex<N, E>): ClipboardPayload<N, E> | undefined {
  const ids = new Set<string>();
  const visit = (id: string) => {
    if (ids.has(id)) return;
    ids.add(id);
    for (const child of index.childrenOf(id)) visit(child.id);
  };
  for (const node of state.nodes) if (node.selected) visit(node.id);
  if (!ids.size) return undefined;
  const nodes = state.nodes
    .filter((node) => ids.has(node.id))
    .map((node) => {
      const record = copy(node);
      delete record.selected;
      if (record.parent !== undefined && !ids.has(record.parent)) {
        delete record.parent;
        record.position = absolutePosition(index, node.id)!;
      }
      return record;
    });
  const edges = state.edges
    .filter((edge) => ids.has(edge.source.node) && ids.has(edge.target.node))
    .map((edge) => {
      const record = copy(edge);
      delete record.selected;
      return record;
    });
  return { nodes, edges };
}

const isPoint = (value: unknown): value is Point =>
  typeof value === 'object' && value !== null && typeof (value as Point).x === 'number' && typeof (value as Point).y === 'number';
const isEnd = (value: unknown) =>
  typeof value === 'object' && value !== null && typeof (value as { node: unknown }).node === 'string';

/** A payload read from the clipboard's text, or `undefined` when it isn't one. */
export function parsePayload(text: string): ClipboardPayload | undefined {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null) return undefined;
  const { nodes, edges } = value as { nodes?: unknown; edges?: unknown };
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return undefined;
  const validNodes = nodes.every(
    (node) => typeof node === 'object' && node !== null && typeof node.id === 'string' && isPoint(node.position),
  );
  const validEdges = edges.every(
    (edge) =>
      typeof edge === 'object' && edge !== null && typeof edge.id === 'string' && isEnd(edge.source) && isEnd(edge.target),
  );
  return validNodes && validEdges ? (value as ClipboardPayload) : undefined;
}

/** How far a paste lands from the copied Nodes when there is no pointer over the Flow to place it at. */
export const PASTE_OFFSET = 20;

/**
 * The records to add for a paste: new ids from `createId`, Parents and Edges rewritten to them, Edges to Nodes outside
 * the payload dropped, and everything selected. The top-left of the top-level Nodes lands at `at`, else
 * `PASTE_OFFSET` from where it was.
 */
export function pastePayload<N, E>(payload: ClipboardPayload<N, E>, createId: () => string, at?: Point): ClipboardPayload<N, E> {
  const ids = new Map(payload.nodes.map((node) => [node.id, createId()]));
  const nodes = payload.nodes.map((node) => {
    const record = copy(node);
    record.id = ids.get(node.id)!;
    record.selected = true;
    const parent = record.parent === undefined ? undefined : ids.get(record.parent);
    if (parent === undefined) delete record.parent;
    else record.parent = parent;
    return record;
  });
  const top = nodes.filter((node) => node.parent === undefined);
  if (top.length) {
    const min = { x: Math.min(...top.map((node) => node.position.x)), y: Math.min(...top.map((node) => node.position.y)) };
    const dx = at ? at.x - min.x : PASTE_OFFSET;
    const dy = at ? at.y - min.y : PASTE_OFFSET;
    for (const node of top) node.position = { x: node.position.x + dx, y: node.position.y + dy };
  }
  const edges = payload.edges
    .filter((edge) => ids.has(edge.source.node) && ids.has(edge.target.node))
    .map((edge) => {
      const record = copy(edge);
      record.id = createId();
      record.source = { ...record.source, node: ids.get(edge.source.node)! };
      record.target = { ...record.target, node: ids.get(edge.target.node)! };
      record.selected = true;
      return record;
    });
  return { nodes, edges };
}
