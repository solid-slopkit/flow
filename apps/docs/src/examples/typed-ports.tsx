import { createStore, For } from 'solid-js';
import { applyChanges, Edge, Flow, Node, Port, type End, type FlowState } from '@solid-slopkit/flow';

type Block = { title: string; inputs: string[]; outputs: string[] };

// A Port's id names its value type: "number-in", "text-out", …
const typeOf = (end: End) => end.port?.split('-')[0];
const colors: Record<string, string> = { number: 'var(--slp-color-info)', text: 'var(--slp-color-warning)' };

export default function TypedPorts() {
  const [flow, setFlow] = createStore<FlowState<Block, null>>({
    nodes: [
      { id: 'count', position: { x: 20, y: 40 }, data: { title: 'Count', inputs: [], outputs: ['number'] } },
      { id: 'name', position: { x: 20, y: 200 }, data: { title: 'Name', inputs: [], outputs: ['text'] } },
      { id: 'format', position: { x: 260, y: 110 }, data: { title: 'Format', inputs: ['number', 'text'], outputs: ['text'] } },
      { id: 'print', position: { x: 500, y: 120 }, data: { title: 'Print', inputs: ['text'], outputs: [] } },
    ],
    edges: [],
  });

  // Asked after Port kinds and max: same value type, and no second Edge between the same two Ports.
  const canConnect = (source: End, target: End) =>
    typeOf(source) === typeOf(target) &&
    !flow.edges.some(
      (edge) =>
        edge.source.node === source.node &&
        edge.source.port === source.port &&
        edge.target.node === target.node &&
        edge.target.port === target.port,
    );

  return (
    <Flow state={flow} onChange={(batch) => applyChanges(setFlow, batch)} canConnect={canConnect} fitView>
      <For each={flow.nodes}>
        {(node) => (
          <Node id={node.id} class="example-node" style={{ 'min-height': '3.5rem' }}>
            <For each={node.data.inputs}>
              {(type, i) => (
                <Port
                  id={`${type}-in`}
                  side="left"
                  kind="target"
                  max={1}
                  offset={(i() + 1) / (node.data.inputs.length + 1)}
                  style={{ background: colors[type] }}
                />
              )}
            </For>
            {node.data.title}
            <For each={node.data.outputs}>
              {(type, i) => (
                <Port
                  id={`${type}-out`}
                  side="right"
                  kind="source"
                  offset={(i() + 1) / (node.data.outputs.length + 1)}
                  style={{ background: colors[type] }}
                />
              )}
            </For>
          </Node>
        )}
      </For>
      <For each={flow.edges}>{(edge) => <Edge id={edge.id} style={{ color: colors[typeOf(edge.source)!] }} />}</For>
    </Flow>
  );
}
