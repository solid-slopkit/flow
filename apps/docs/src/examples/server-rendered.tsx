import { createStore, For } from 'solid-js';
import { applyChanges, Edge, Flow, Node, Port, type FlowState, type PortSpec } from '@solid-slopkit/flow';

type Stage = { title: string };

// Every Node declares its size and its Ports, so the server can place every Edge without measuring.
const size = { width: 120, height: 40 };
const ports: PortSpec[] = [
  { id: 'in', side: 'left', kind: 'target' },
  { id: 'out', side: 'right', kind: 'source' },
];

export default function ServerRendered() {
  const [flow, setFlow] = createStore<FlowState<Stage, null>>({
    nodes: [
      { id: 'fetch', position: { x: 0, y: 80 }, size, ports, data: { title: 'Fetch' } },
      { id: 'parse', position: { x: 200, y: 0 }, size, ports, data: { title: 'Parse' } },
      { id: 'validate', position: { x: 200, y: 160 }, size, ports, data: { title: 'Validate' } },
      { id: 'store', position: { x: 400, y: 80 }, size, ports, data: { title: 'Store' } },
    ],
    edges: [
      { id: 'e1', source: { node: 'fetch', port: 'out' }, target: { node: 'parse', port: 'in' }, data: null },
      { id: 'e2', source: { node: 'fetch', port: 'out' }, target: { node: 'validate', port: 'in' }, data: null },
      { id: 'e3', source: { node: 'parse', port: 'out' }, target: { node: 'store', port: 'in' }, data: null },
      { id: 'e4', source: { node: 'validate', port: 'out' }, target: { node: 'store', port: 'in' }, data: null },
    ],
  });

  // With its own width and height, the Flow fits the view while rendering, on the server too.
  return (
    <Flow state={flow} onChange={(batch) => applyChanges(setFlow, batch)} width={640} height={352} fitView>
      <For each={flow.nodes}>
        {(node) => (
          <Node id={node.id} class="example-node">
            <Port id="in" />
            {node.data.title}
            <Port id="out" />
          </Node>
        )}
      </For>
      <For each={flow.edges}>{(edge) => <Edge id={edge.id} markerEnd="arrow-closed" />}</For>
    </Flow>
  );
}
