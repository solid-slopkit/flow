import { createStore, For } from 'solid-js';
import { applyChanges, Edge, Flow, Node, Port, type FlowState } from '@solid-slopkit/flow';

type Step = { title: string };

export default function QuickStart() {
  // The app owns the data: the Flow reads it and proposes every edit as a Batch.
  const [flow, setFlow] = createStore<FlowState<Step, null>>({
    nodes: [
      { id: 'idea', position: { x: 0, y: 60 }, data: { title: 'Idea' } },
      { id: 'draft', position: { x: 220, y: 0 }, data: { title: 'Draft' } },
      { id: 'review', position: { x: 220, y: 120 }, data: { title: 'Review' } },
      { id: 'ship', position: { x: 440, y: 60 }, data: { title: 'Ship' } },
    ],
    edges: [
      { id: 'e1', source: { node: 'idea', port: 'out' }, target: { node: 'draft', port: 'in' }, data: null },
      { id: 'e2', source: { node: 'idea', port: 'out' }, target: { node: 'review', port: 'in' }, data: null },
      { id: 'e3', source: { node: 'draft', port: 'out' }, target: { node: 'ship', port: 'in' }, data: null },
    ],
  });

  return (
    <Flow state={flow} onChange={(batch) => applyChanges(setFlow, batch)} fitView>
      <For each={flow.nodes}>
        {(node) => (
          <Node id={node.id} class="example-node">
            <Port id="in" side="left" kind="target" />
            {node.data.title}
            <Port id="out" side="right" kind="source" />
          </Node>
        )}
      </For>
      <For each={flow.edges}>{(edge) => <Edge id={edge.id} markerEnd="arrow-closed" />}</For>
    </Flow>
  );
}
