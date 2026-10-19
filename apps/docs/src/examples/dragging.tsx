import { createSignal, createStore, For } from 'solid-js';
import { Switch } from '@solid-slopkit/components';
import { applyChanges, Flow, Node, type FlowState } from '@solid-slopkit/flow';

export default function Dragging() {
  const [flow, setFlow] = createStore<FlowState<string, null>>({
    nodes: [
      { id: 'a', position: { x: 60, y: 80 }, data: 'Drag me' },
      { id: 'b', position: { x: 300, y: 60 }, data: 'Line me up' },
      { id: 'c', position: { x: 200, y: 220 }, data: 'Only by the dots', draggable: true },
      { id: 'd', position: { x: 460, y: 200 }, data: 'Pinned', draggable: false },
    ],
    edges: [],
  });
  const [grid, setGrid] = createSignal(false);
  const [guides, setGuides] = createSignal(true);

  return (
    <>
      <Flow
        state={flow}
        onChange={(batch) => applyChanges(setFlow, batch)}
        snapToGrid={grid() ? 20 : undefined}
        alignmentGuides={guides()}
      >
        <For each={flow.nodes}>
          {(node) => (
            <Node id={node.id} class="example-node" dragHandle={node.id === 'c' ? '.handle' : undefined}>
              {node.id === 'c' && <span class="handle">⠿ </span>}
              {node.data}
            </Node>
          )}
        </For>
      </Flow>
      <div class="docs-flow-toolbar">
        <Switch size="xs" label="Snap to a 20 px grid" checked={grid()} onChange={setGrid} />
        <Switch size="xs" label="Alignment guides" checked={guides()} onChange={setGuides} />
      </div>
    </>
  );
}
