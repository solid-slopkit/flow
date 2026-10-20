import { createStore, For } from 'solid-js';
import { applyChanges, Background, Controls, Flow, Node, type FlowState } from '@solid-slopkit/flow';

export default function Grid() {
  const [flow, setFlow] = createStore<FlowState<string, null>>({
    nodes: [
      { id: 'a', position: { x: 40, y: 40 }, data: 'Snaps to 20' },
      { id: 'b', position: { x: 240, y: 140 }, data: 'Drag me' },
    ],
    edges: [],
  });

  return (
    <Flow state={flow} onChange={(batch) => applyChanges(setFlow, batch)} snapToGrid={20}>
      {/* Fine lines every 20, under major lines every 100. */}
      <Background variant="lines" gap={20} color="var(--slp-color-base-200)" />
      <Background variant="lines" gap={100} />
      <Controls position="top-right" orientation="horizontal" showLock={false} />
      <For each={flow.nodes}>
        {(node) => (
          <Node id={node.id} class="example-node">
            {node.data}
          </Node>
        )}
      </For>
    </Flow>
  );
}
