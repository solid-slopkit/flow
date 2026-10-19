// The spatial order keyboard focus follows over a Flow's records. Pure: no DOM.
import { absolutePosition } from '../geometry/geometry';
import type { FlowIndex } from '../model/flow-index';
import type { FlowNode, FlowState } from '../model/model';

/**
 * Node ids in reading order: top-level Nodes by their top edge, then their left edge, each followed by the Nodes nested
 * in it, ordered the same way. Ties keep state order. Nodes on a cycle of Parents come last.
 */
export function spatialOrder(state: FlowState, index: FlowIndex): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const sorted = (nodes: readonly FlowNode[]) =>
    nodes
      .map((node, i) => ({ node, i, at: absolutePosition(index, node.id) ?? node.position }))
      .sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x || a.i - b.i)
      .map(({ node }) => node);
  const visit = (node: FlowNode) => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    order.push(node.id);
    for (const child of sorted(index.childrenOf(node.id))) visit(child);
  };
  for (const node of sorted(state.nodes.filter((node) => node.parent === undefined || !index.node(node.parent)))) visit(node);
  for (const node of state.nodes) visit(node);
  return order;
}

/** Edge ids ordered by where their Nodes come in `nodes`: by Source, then Target, ties in state order. */
export function edgeOrder(state: FlowState, nodes: readonly string[]): string[] {
  const rank = new Map(nodes.map((id, i) => [id, i]));
  const of = (id: string) => rank.get(id) ?? nodes.length;
  return state.edges
    .map((edge, i) => ({ id: edge.id, source: of(edge.source.node), target: of(edge.target.node), i }))
    .sort((a, b) => a.source - b.source || a.target - b.target || a.i - b.i)
    .map(({ id }) => id);
}
