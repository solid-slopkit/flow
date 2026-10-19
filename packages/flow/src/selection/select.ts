// Selection as Changes (ADR 0014): the `selected` flags live in the app's data, so selecting is a Batch of `select`
// Changes from the current flags to the wanted ones. Pure: no DOM.
import type { SelectChange } from '../changes/changes';
import type { FlowIndex } from '../model/flow-index';
import type { FlowState } from '../model/model';

/** The ids of the selected Nodes and Edges. */
export type SelectedIds = { nodes: ReadonlySet<string>; edges: ReadonlySet<string> };

export function selectedIds(state: FlowState): { nodes: Set<string>; edges: Set<string> } {
  return {
    nodes: new Set(state.nodes.filter((node) => node.selected).map((node) => node.id)),
    edges: new Set(state.edges.filter((edge) => edge.selected).map((edge) => edge.id)),
  };
}

/** The `select` Changes that make exactly these Nodes and Edges selected; none for a flag already right. */
export function selectionChanges(state: FlowState, wanted: SelectedIds): SelectChange[] {
  const changes: SelectChange[] = [];
  for (const node of state.nodes) {
    const to = wanted.nodes.has(node.id);
    if ((node.selected ?? false) !== to) changes.push({ type: 'select', item: 'node', id: node.id, from: !to, to });
  }
  for (const edge of state.edges) {
    const to = wanted.edges.has(edge.id);
    if ((edge.selected ?? false) !== to) changes.push({ type: 'select', item: 'edge', id: edge.id, from: !to, to });
  }
  return changes;
}

/** Whether `ancestor` is one of the Parents above `id`. A cycle of Parents ends the walk. */
export function isAncestor(index: FlowIndex, ancestor: string, id: string): boolean {
  const seen = new Set<string>();
  for (let parent = index.node(id)?.parent; parent !== undefined && !seen.has(parent); parent = index.node(parent)?.parent) {
    if (parent === ancestor) return true;
    seen.add(parent);
  }
  return false;
}

/** These Nodes without any whose Parent (at any depth) is among them: the ones that move, the rest move with them. */
export function topmost(index: FlowIndex, ids: readonly string[]): string[] {
  return ids.filter((id) => !ids.some((other) => other !== id && isAncestor(index, other, id)));
}
