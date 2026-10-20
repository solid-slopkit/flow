import { createStore, For } from 'solid-js';
import { applyChanges, Controls, Edge, Flow, MiniMap, Node, Port, type FlowState } from '@solid-slopkit/flow';

const COLUMNS = 50;
const ROWS = 40;
const size = { width: 120, height: 40 };
const ports = [
  { id: 'in', side: 'left' as const },
  { id: 'out', side: 'right' as const },
];

// 2,000 Nodes in a grid, each joined to the one on its right.
function grid(): FlowState<string, null> {
  const nodes = Array.from({ length: COLUMNS * ROWS }, (_, i) => ({
    id: `n${i}`,
    position: { x: (i % COLUMNS) * 180, y: Math.floor(i / COLUMNS) * 80 },
    size,
    ports,
    data: `Node ${i + 1}`,
  }));
  const edges = nodes
    .filter((_, i) => i % COLUMNS !== COLUMNS - 1)
    .map((node, i) => ({
      id: `e${i}`,
      source: { node: node.id, port: 'out' },
      target: { node: `n${Number(node.id.slice(1)) + 1}`, port: 'in' },
      data: null,
    }));
  return { nodes, edges };
}

export default function LargeFlow() {
  const [flow, setFlow] = createStore(grid());

  return (
    <Flow state={flow} onChange={(batch) => applyChanges(setFlow, batch)} onlyRenderVisible minZoom={0.2}>
      <Controls />
      <MiniMap />
      <For each={flow.nodes}>
        {(node) => (
          <Node id={node.id} class="example-node">
            <Port id="in" />
            {node.data}
            <Port id="out" />
          </Node>
        )}
      </For>
      <For each={flow.edges}>{(edge) => <Edge id={edge.id} />}</For>
    </Flow>
  );
}
