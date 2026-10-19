import { createStore, For } from 'solid-js';
import { applyChanges, Flow, Node, NodeResizer, type FlowState } from '@solid-slopkit/flow';

export default function Resizing() {
  const [flow, setFlow] = createStore<FlowState<string, null>>({
    nodes: [
      { id: 'free', position: { x: 60, y: 80 }, size: { width: 160, height: 80 }, selected: true, data: 'Any size from 80 × 40' },
      {
        id: 'square',
        position: { x: 320, y: 60 },
        size: { width: 120, height: 120 },
        selected: true,
        data: 'Keeps its aspect ratio',
      },
    ],
    edges: [],
  });

  return (
    <Flow state={flow} onChange={(batch) => applyChanges(setFlow, batch)}>
      <For each={flow.nodes}>
        {(node) => (
          <Node id={node.id} class="example-node">
            {/* Shown while the Node is selected. */}
            <NodeResizer minWidth={80} minHeight={40} maxWidth={360} keepAspectRatio={node.id === 'square'} />
            {node.data}
          </Node>
        )}
      </For>
    </Flow>
  );
}
