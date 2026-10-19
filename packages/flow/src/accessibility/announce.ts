// What the live region says about a gesture's Changes. Pure: no DOM. Each gesture says one thing, by priority: a
// removal, an addition, a Connection, a reconnected Edge, a move, then the Selection it leaves.
import type { Change } from '../changes/changes';
import type { FlowIndex } from '../model/flow-index';
import type { End } from '../model/model';
import type { SelectedIds } from '../selection/select';
import type { FlowMessages } from './messages';

export interface AnnounceContext {
  index: FlowIndex;
  /** The Selection before the Changes. */
  selected: SelectedIds;
  /** A Node's name, as its label reads. */
  nodeName(id: string): string;
  messages: FlowMessages;
}

/** The announcement for these Changes, or `undefined` when they say nothing worth announcing. */
export function announcement(changes: readonly Change[], context: AnnounceContext): string | undefined {
  const { index, nodeName, messages } = context;

  const removed = changes.filter((change) => change.type === 'remove');
  if (removed.length) {
    return messages.removed({
      nodes: removed.flatMap((change) => change.nodes.map((node) => nodeName(node.id))),
      edges: removed.reduce((count, change) => count + change.edges.length, 0),
    });
  }

  const added = changes.filter((change) => change.type === 'add');
  if (added.length) {
    return messages.added({
      nodes: added.reduce((count, change) => count + change.nodes.length, 0),
      edges: added.reduce((count, change) => count + change.edges.length, 0),
    });
  }

  const connect = changes.find((change) => change.type === 'connect');
  if (connect) {
    const { source, target } = connect.edge;
    return messages.connected({ source: nodeName(source.node), target: nodeName(target.node) });
  }

  const reconnect = changes.findLast((change) => change.type === 'reconnect');
  if (reconnect) {
    const edge = index.edge(reconnect.edge);
    const ends: Record<'source' | 'target', End | undefined> = { source: edge?.source, target: edge?.target };
    ends[reconnect.end] = reconnect.to;
    if (ends.source && ends.target) {
      return messages.reconnected({ source: nodeName(ends.source.node), target: nodeName(ends.target.node) });
    }
  }

  const moves = changes.filter((change) => change.type === 'move');
  if (moves.length) {
    const nodes = [...new Set(moves.map((move) => move.node))];
    const position = moves.findLast((move) => move.node === nodes[0])!.to;
    return messages.moved({ nodes: nodes.map(nodeName), position });
  }

  const selects = changes.filter((change) => change.type === 'select');
  if (selects.length) {
    const nodes = new Set(context.selected.nodes);
    const edges = new Set(context.selected.edges);
    for (const change of selects) {
      const set = change.item === 'node' ? nodes : edges;
      if (change.to) set.add(change.id);
      else set.delete(change.id);
    }
    return messages.selected({ nodes: [...nodes].map(nodeName), edges: edges.size });
  }
  return undefined;
}
