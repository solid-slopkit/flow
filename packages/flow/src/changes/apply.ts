import type { StoreSetter } from 'solid-js';

import type { End, FlowEdge, FlowNode, FlowState, Point } from '../model/model';
import type { Batch, RemoveChange } from './changes';

// Records and values from a Change are copied into the store, never adopted: a store writes through to the object it
// wraps, so a later edit would otherwise rewrite the Change, and History with it.
const copyEnd = (end: End): End => (end.port === undefined ? { node: end.node } : { node: end.node, port: end.port });

function copyField(key: string, value: unknown): unknown {
  switch (key) {
    case 'position':
    case 'size':
    case 'source':
    case 'target':
      return { ...(value as object) };
    case 'ports':
      return (value as object[]).map((port) => ({ ...port }));
    default:
      return value;
  }
}

function copyRecord<T extends object>(record: T): T {
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) if (value !== undefined) copy[key] = copyField(key, value);
  return copy as T;
}

function setFields(record: Record<string, unknown>, fields: object) {
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) delete record[key];
    else record[key] = copyField(key, value);
  }
}

/** The Nodes with these ids and everything nested in them, and every Edge at one of them. */
function cascade<N, E>(state: FlowState<N, E>, nodeIds: Iterable<string>, edgeIds: Iterable<string>) {
  const children = new Map<string, string[]>();
  for (const node of state.nodes) {
    if (node.parent === undefined) continue;
    const list = children.get(node.parent);
    if (list) list.push(node.id);
    else children.set(node.parent, [node.id]);
  }
  const nodes = new Set<string>();
  const visit = (id: string) => {
    if (nodes.has(id)) return;
    nodes.add(id);
    for (const child of children.get(id) ?? []) visit(child);
  };
  for (const id of nodeIds) visit(id);
  const edges = new Set(edgeIds);
  for (const edge of state.edges) if (nodes.has(edge.source.node) || nodes.has(edge.target.node)) edges.add(edge.id);
  return { nodes, edges };
}

/**
 * The `remove` Change for these Nodes and Edges, complete: it carries every Node nested in a removed Node and every
 * Edge at a removed Node, copied from the state, and where each one sat, so its Inverse puts all of them back.
 */
export function removal<N, E>(state: FlowState<N, E>, ids: { nodes?: string[]; edges?: string[] }): RemoveChange<N, E> {
  const removed = cascade(state, ids.nodes ?? [], ids.edges ?? []);
  const change: RemoveChange<N, E> = { type: 'remove', nodes: [], edges: [], at: { nodes: [], edges: [] } };
  state.nodes.forEach((node, i) => {
    if (!removed.nodes.has(node.id)) return;
    change.nodes.push(copyRecord(node));
    change.at!.nodes.push(i);
  });
  state.edges.forEach((edge, i) => {
    if (!removed.edges.has(edge.id)) return;
    change.edges.push(copyRecord(edge));
    change.at!.edges.push(i);
  });
  return change;
}

function removeWhere<T extends { id: string }>(list: T[], ids: Set<string>, byId: Map<string, T>) {
  for (let i = list.length - 1; i >= 0; i--) {
    const id = list[i]!.id;
    if (!ids.has(id)) continue;
    list.splice(i, 1);
    byId.delete(id);
  }
}

/**
 * Applies a Batch to the app's store in one write, Change by Change. Changes naming a record that isn't there are
 * skipped. Removing a Node also removes the Nodes nested in it and the Edges at any of them.
 */
export function applyChanges<N, E>(setFlow: StoreSetter<FlowState<N, E>>, batch: Batch<N, E>): void {
  if (batch.changes.length === 0) return;
  setFlow((flow) => {
    const nodes = new Map<string, FlowNode<N>>(flow.nodes.map((node) => [node.id, node]));
    const edges = new Map<string, FlowEdge<E>>(flow.edges.map((edge) => [edge.id, edge]));
    const insert = <T extends { id: string }>(list: T[], byId: Map<string, T>, record: T, at = list.length) => {
      const i = Math.min(at, list.length);
      list.splice(i, 0, copyRecord(record));
      byId.set(record.id, list[i]!);
    };
    const place = (node: FlowNode<N>, to: Point) => {
      node.position.x = to.x;
      node.position.y = to.y;
    };

    for (const change of batch.changes) {
      switch (change.type) {
        case 'add':
          change.nodes.forEach((node, i) => insert(flow.nodes, nodes, node, change.at?.nodes[i]));
          change.edges.forEach((edge, i) => insert(flow.edges, edges, edge, change.at?.edges[i]));
          break;
        case 'remove': {
          const removed = cascade(
            flow,
            change.nodes.map((node) => node.id),
            change.edges.map((edge) => edge.id),
          );
          removeWhere(flow.edges, removed.edges, edges);
          removeWhere(flow.nodes, removed.nodes, nodes);
          break;
        }
        case 'connect':
          insert(flow.edges, edges, change.edge);
          break;
        case 'move': {
          const node = nodes.get(change.node);
          if (node) place(node, change.to);
          break;
        }
        case 'select': {
          const record = change.item === 'node' ? nodes.get(change.id) : edges.get(change.id);
          if (!record) break;
          if (change.to) record.selected = true;
          else delete record.selected;
          break;
        }
        case 'resize': {
          const node = nodes.get(change.node);
          if (!node) break;
          place(node, change.to.position);
          const size = change.to.size;
          if (!size) delete node.size;
          else if (node.size) {
            node.size.width = size.width;
            node.size.height = size.height;
          } else node.size = { width: size.width, height: size.height };
          break;
        }
        case 'reconnect': {
          const edge = edges.get(change.edge);
          if (edge) edge[change.end] = copyEnd(change.to);
          break;
        }
        case 'reparent': {
          const node = nodes.get(change.node);
          if (!node) break;
          if (change.to.parent === undefined) delete node.parent;
          else node.parent = change.to.parent;
          place(node, change.to.position);
          break;
        }
        case 'update': {
          const record = change.item === 'node' ? nodes.get(change.id) : edges.get(change.id);
          if (record) setFields(record as Record<string, unknown>, change.to);
          break;
        }
      }
    }
  });
}
