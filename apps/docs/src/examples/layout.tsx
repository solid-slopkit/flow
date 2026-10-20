import { createStore, For } from 'solid-js';
import { ActionIcon } from '@solid-slopkit/components';
import { LayoutGrid } from '@lucide/solid';
import { applyChanges, Controls, Edge, Flow, Node, Port, useFlow, type Batch, type FlowState } from '@solid-slopkit/flow';
import { elkInWorker, layout, type ELK } from '@solid-slopkit/flow/layout';
import workerUrl from 'elkjs/lib/elk-worker.min.js?url';

// ELK runs in a Web Worker, started on the first layout.
let elk: ELK | undefined;

/** A button among the Controls that lays the Flow out and fits it in view. */
function LayoutButton(props: { apply: (batch: Batch<string, null>) => void }) {
  const flow = useFlow<string, null>();
  const arrange = async () => {
    elk ??= elkInWorker(workerUrl);
    props.apply(await layout(flow.state(), { measured: flow, elk }));
    requestAnimationFrame(() => flow.fitView());
  };
  return (
    <ActionIcon label="Lay out" title="Lay out" size="sm" onClick={arrange}>
      <LayoutGrid size={16} />
    </ActionIcon>
  );
}

export default function Layout() {
  const [flow, setFlow] = createStore<FlowState<string, null>>({
    nodes: [
      { id: 'build', position: { x: 380, y: 220 }, data: 'Build' },
      { id: 'lint', position: { x: 40, y: 40 }, data: 'Lint' },
      { id: 'test', position: { x: 560, y: 40 }, data: 'Test' },
      { id: 'docs', position: { x: 60, y: 260 }, data: 'Docs' },
      { id: 'release', position: { x: 260, y: 120 }, data: 'Release' },
    ],
    edges: [
      ['lint', 'build'],
      ['build', 'test'],
      ['build', 'docs'],
      ['test', 'release'],
      ['docs', 'release'],
    ].map(([source, target]) => ({
      id: `${source}-${target}`,
      source: { node: source!, port: 'out' },
      target: { node: target!, port: 'in' },
      shape: 'routed-step' as const,
      data: null,
    })),
  });
  const apply = (batch: Batch<string, null>) => applyChanges(setFlow, batch);

  return (
    <Flow state={flow} onChange={apply} fitView>
      <Controls>
        <LayoutButton apply={apply} />
      </Controls>
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
