import type { FlowEdge, FlowNode, FlowState } from './model';

/** Lookups over one FlowState by id. Built once in O(Nodes + Edges); it does not follow later edits. */
export interface FlowIndex<N = unknown, E = unknown> {
  node(id: string): FlowNode<N> | undefined;
  edge(id: string): FlowEdge<E> | undefined;
  /** The Edges with the Node at either end, in state order. A loop on the Node is listed once. */
  edgesOf(node: string): readonly FlowEdge<E>[];
  /** The Nodes whose `parent` is this Node, in state order. */
  childrenOf(parent: string): readonly FlowNode<N>[];
}

const none: readonly never[] = Object.freeze([]);

export function indexFlow<N, E>(state: FlowState<N, E>): FlowIndex<N, E> {
  const nodes = new Map<string, FlowNode<N>>();
  const edges = new Map<string, FlowEdge<E>>();
  const edgesByNode = new Map<string, FlowEdge<E>[]>();
  const children = new Map<string, FlowNode<N>[]>();
  const push = <T>(map: Map<string, T[]>, key: string, value: T) => {
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
  };

  for (const node of state.nodes) {
    nodes.set(node.id, node);
    if (node.parent !== undefined) push(children, node.parent, node);
  }
  for (const edge of state.edges) {
    edges.set(edge.id, edge);
    push(edgesByNode, edge.source.node, edge);
    if (edge.target.node !== edge.source.node) push(edgesByNode, edge.target.node, edge);
  }

  return {
    node: (id) => nodes.get(id),
    edge: (id) => edges.get(id),
    edgesOf: (node) => edgesByNode.get(node) ?? none,
    childrenOf: (parent) => children.get(parent) ?? none,
  };
}
