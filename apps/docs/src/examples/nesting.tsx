import { createStore, For } from 'solid-js';
import { applyChanges, Flow, Node, type FlowState } from '@solid-slopkit/flow';

export default function Nesting() {
  const [flow, setFlow] = createStore<FlowState<string, null>>({
    nodes: [
      { id: 'group', position: { x: 40, y: 40 }, size: { width: 260, height: 200 }, data: 'Group' },
      // Positions of nested Nodes are relative to their Parent.
      { id: 'inside', position: { x: 30, y: 50 }, parent: 'group', data: 'Nested' },
      { id: 'kept', position: { x: 60, y: 130 }, parent: 'group', data: 'Kept inside' },
      { id: 'free', position: { x: 380, y: 120 }, data: 'Drop me in the group' },
    ],
    edges: [],
  });

  return (
    // reparentOnDrop: dropping Nodes on another nests them in it; dropping them on empty space makes them top-level.
    <Flow state={flow} onChange={(batch) => applyChanges(setFlow, batch)} reparentOnDrop={(_, parent) => parent?.id !== 'free'}>
      <For each={flow.nodes}>
        {(node) => (
          <Node id={node.id} class={node.id === 'group' ? 'example-group' : 'example-node'} keepInParent={node.id === 'kept'}>
            {node.data}
          </Node>
        )}
      </For>
    </Flow>
  );
}
