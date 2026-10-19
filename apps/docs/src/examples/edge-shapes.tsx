import { createSignal, createStore, For } from 'solid-js';
import { SegmentedControl } from '@solid-slopkit/components';
import { applyChanges, Edge, Flow, Node, Port, type EdgeShapeName, type FlowState } from '@solid-slopkit/flow';

const shapes: EdgeShapeName[] = ['bezier', 'straight', 'step', 'smooth-step'];

export default function EdgeShapes() {
  const [flow, setFlow] = createStore<FlowState<string, string>>({
    nodes: [
      { id: 'a', position: { x: 40, y: 140 }, data: 'Source' },
      { id: 'b', position: { x: 340, y: 40 }, data: 'Up' },
      { id: 'c', position: { x: 340, y: 240 }, data: 'Down' },
    ],
    edges: [
      { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' }, data: 'label' },
      // No Ports: Floating ends, clipped to the Nodes' outlines.
      { id: 'ac', source: { node: 'a' }, target: { node: 'c' }, data: 'floating' },
    ],
  });
  const [shape, setShape] = createSignal<EdgeShapeName>('bezier');

  return (
    <>
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
        <For each={flow.edges}>
          {(edge) => (
            <Edge
              id={edge.id}
              shape={shape()}
              markerEnd="arrow-closed"
              markerStart={edge.id === 'ac' ? 'arrow' : undefined}
              label={<span class="example-node">{edge.data}</span>}
            />
          )}
        </For>
      </Flow>
      <div class="docs-flow-toolbar">
        <SegmentedControl size="xs" data={shapes} value={shape()} onChange={setShape} />
      </div>
    </>
  );
}
