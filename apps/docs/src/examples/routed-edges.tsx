import { createStore, For } from 'solid-js';
import { applyChanges, Edge, Flow, Node, Port, type FlowState } from '@solid-slopkit/flow';

export default function RoutedEdges() {
  const [flow, setFlow] = createStore<FlowState<string, null>>({
    nodes: [
      { id: 'a', position: { x: 40, y: 150 }, data: 'Source' },
      { id: 'wall', position: { x: 260, y: 140 }, data: 'Drag me' },
      { id: 'b', position: { x: 480, y: 150 }, data: 'Target' },
      { id: 'c', position: { x: 480, y: 290 }, data: 'Below' },
    ],
    edges: [
      { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' }, shape: 'routed-step', data: null },
      { id: 'ac', source: { node: 'a', port: 'out' }, target: { node: 'c', port: 'in' }, shape: 'routed-step', data: null },
    ],
  });

  return (
    <Flow state={flow} onChange={(batch) => applyChanges(setFlow, batch)}>
      <For each={flow.nodes}>
        {(node) => (
          <Node id={node.id} class="example-node">
            <Port id="in" side="left" />
            {node.data}
            <Port id="out" side="right" />
          </Node>
        )}
      </For>
      <For each={flow.edges}>{(edge) => <Edge id={edge.id} markerEnd="arrow-closed" />}</For>
    </Flow>
  );
}
