import { createSignal, createStore, For } from 'solid-js';
import { SegmentedControl } from '@solid-slopkit/components';
import {
  applyChanges,
  Background,
  Controls,
  Edge,
  Flow,
  MiniMap,
  Node,
  Port,
  type BackgroundVariant,
  type FlowState,
} from '@solid-slopkit/flow';

const variants: BackgroundVariant[] = ['dots', 'lines', 'cross'];

export default function BuiltInUi() {
  const [flow, setFlow] = createStore<FlowState<string, null>>({
    nodes: [
      { id: 'in', position: { x: 0, y: 100 }, data: 'Inbox' },
      { id: 'triage', position: { x: 220, y: 100 }, data: 'Triage' },
      { id: 'fix', position: { x: 440, y: 0 }, data: 'Fix' },
      { id: 'wontfix', position: { x: 440, y: 200 }, data: "Won't fix" },
      { id: 'done', position: { x: 660, y: 100 }, data: 'Done' },
    ],
    edges: [
      { id: 'e1', source: { node: 'in', port: 'out' }, target: { node: 'triage', port: 'in' }, data: null },
      { id: 'e2', source: { node: 'triage', port: 'out' }, target: { node: 'fix', port: 'in' }, data: null },
      { id: 'e3', source: { node: 'triage', port: 'out' }, target: { node: 'wontfix', port: 'in' }, data: null },
      { id: 'e4', source: { node: 'fix', port: 'out' }, target: { node: 'done', port: 'in' }, data: null },
    ],
  });
  const [variant, setVariant] = createSignal<BackgroundVariant>('dots');

  return (
    <>
      <Flow state={flow} onChange={(batch) => applyChanges(setFlow, batch)} fitView>
        <Background variant={variant()} />
        <Controls />
        <MiniMap width={160} height={100} />
        <For each={flow.nodes}>
          {(node) => (
            <Node id={node.id} class="example-node">
              <Port id="in" side="left" kind="target" />
              {node.data}
              <Port id="out" side="right" kind="source" />
            </Node>
          )}
        </For>
        <For each={flow.edges}>{(edge) => <Edge id={edge.id} markerEnd="arrow-closed" />}</For>
      </Flow>
      <div class="docs-flow-toolbar">
        <SegmentedControl size="xs" data={variants} value={variant()} onChange={setVariant} />
      </div>
    </>
  );
}
