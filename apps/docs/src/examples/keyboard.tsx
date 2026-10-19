import { createStore, For } from 'solid-js';
import { applyChanges, Edge, Flow, Node, Port, type FlowState } from '@solid-slopkit/flow';

type Step = { title: string };

export default function Keyboard() {
  const [flow, setFlow] = createStore<FlowState<Step, null>>({
    nodes: [
      { id: 'order', position: { x: 40, y: 60 }, data: { title: 'Order placed' } },
      { id: 'pay', position: { x: 280, y: 20 }, data: { title: 'Payment' } },
      { id: 'pack', position: { x: 280, y: 160 }, data: { title: 'Packing' } },
      { id: 'ship', position: { x: 520, y: 90 }, data: { title: 'Shipped' } },
    ],
    edges: [{ id: 'order-pay', source: { node: 'order', port: 'out' }, target: { node: 'pay', port: 'in' }, data: null }],
  });

  return (
    // `example-announced` shows the live region, which is visually hidden by default (see examples.css).
    <Flow state={flow} onChange={(batch) => applyChanges(setFlow, batch)} aria-label="Order pipeline" class="example-announced">
      <For each={flow.nodes}>
        {(node) => (
          <Node id={node.id} class="example-node" aria-label={node.data.title}>
            <Port id="in" side="left" kind="target" aria-label={`Into ${node.data.title}`} />
            {node.data.title}
            <Port id="out" side="right" kind="source" aria-label={`Out of ${node.data.title}`} />
          </Node>
        )}
      </For>
      <For each={flow.edges}>{(edge) => <Edge id={edge.id} markerEnd="arrow" />}</For>
    </Flow>
  );
}
