import { createStore, For } from 'solid-js';
import { applyChanges, Edge, Flow, Node, Port, type Batch, type FlowState } from '@solid-slopkit/flow';

export default function ConnectEnd() {
  const [flow, setFlow] = createStore<FlowState<string, null>>({
    nodes: [{ id: 'start', position: { x: 60, y: 140 }, data: 'Start' }],
    edges: [],
  });
  let next = 1;
  const onChange = (batch: Batch<string, null>) => applyChanges(setFlow, batch);

  return (
    <Flow
      state={flow}
      onChange={onChange}
      // Dropped on empty space: add a Node there and connect it, in one Batch.
      onConnectEnd={({ position, source, target }) => {
        const id = `step-${next++}`;
        const node = { id, position: { x: position.x, y: position.y - 18 }, data: `Step ${next - 1}` };
        const edge = source
          ? { id: `${source.node}-${id}`, source, target: { node: id, port: 'in' }, data: null }
          : { id: `${id}-${target!.node}`, source: { node: id, port: 'out' }, target: target!, data: null };
        onChange({ changes: [{ type: 'add', nodes: [node], edges: [edge] }] });
      }}
    >
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
  );
}
