import { createStore, For } from 'solid-js';
import { Button } from '@solid-slopkit/components';
import { applyChanges, createHistory, Edge, Flow, Node, Port, type Batch, type FlowState } from '@solid-slopkit/flow';

export default function Editing() {
  const [flow, setFlow] = createStore<FlowState<string, null>>({
    nodes: [
      { id: 'a', position: { x: 40, y: 80 }, data: 'Alpha' },
      { id: 'b', position: { x: 280, y: 40 }, data: 'Beta' },
      { id: 'c', position: { x: 280, y: 180 }, data: 'Gamma' },
      { id: 'd', position: { x: 520, y: 110 }, data: 'Delta' },
    ],
    edges: [
      { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' }, data: null },
      { id: 'ac', source: { node: 'a', port: 'out' }, target: { node: 'c', port: 'in' }, data: null },
      { id: 'bd', source: { node: 'b', port: 'out' }, target: { node: 'd', port: 'in' }, data: null },
    ],
  });

  // One History entry per gesture; Selection isn't recorded.
  const history = createHistory<string, null>();
  const onChange = (batch: Batch<string, null>) => {
    applyChanges(setFlow, batch);
    history.record(batch);
  };
  const undo = () => {
    const batch = history.undo();
    if (batch) applyChanges(setFlow, batch);
  };
  const redo = () => {
    const batch = history.redo();
    if (batch) applyChanges(setFlow, batch);
  };
  const selected = () =>
    [...flow.nodes, ...flow.edges]
      .filter((record) => record.selected)
      .map((record) => record.id)
      .join(', ') || 'nothing';

  return (
    <>
      <Flow state={flow} onChange={onChange}>
        <For each={flow.nodes}>
          {(node) => (
            <Node id={node.id} class="example-node">
              <Port id="in" side="left" />
              {node.data}
              <Port id="out" side="right" />
            </Node>
          )}
        </For>
        <For each={flow.edges}>{(edge) => <Edge id={edge.id} />}</For>
      </Flow>
      <div class="docs-flow-toolbar">
        <Button size="xs" variant="soft" disabled={!history.canUndo()} onClick={undo}>
          Undo
        </Button>
        <Button size="xs" variant="soft" disabled={!history.canRedo()} onClick={redo}>
          Redo
        </Button>
        <span>Selected: {selected()}</span>
      </div>
    </>
  );
}
