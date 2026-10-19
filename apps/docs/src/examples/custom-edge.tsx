import { createStore, For } from 'solid-js';
import { Button } from '@solid-slopkit/components';
import { applyChanges, Edge, EdgePath, Flow, Node, Port, removal, useEdge, type FlowState } from '@solid-slopkit/flow';

/** The default line, with a dot running along it. */
function Running() {
  const edge = useEdge();
  return (
    <>
      <EdgePath />
      <circle r="4" fill="currentColor">
        <animateMotion dur="2s" repeatCount="indefinite" path={edge.geometry()?.d} />
      </circle>
    </>
  );
}

export default function CustomEdge() {
  const [flow, setFlow] = createStore<FlowState<string, null>>({
    nodes: [
      { id: 'a', position: { x: 40, y: 60 }, data: 'Producer' },
      { id: 'b', position: { x: 360, y: 180 }, data: 'Consumer' },
      { id: 'c', position: { x: 40, y: 260 }, data: 'Backup' },
    ],
    edges: [
      { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' }, data: null },
      { id: 'cb', source: { node: 'c', port: 'out' }, target: { node: 'b', port: 'in' }, data: null },
    ],
  });
  const remove = (id: string) => applyChanges(setFlow, { changes: [removal(flow, { edges: [id] })] });

  return (
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
            shape="smooth-step"
            style={{ color: edge.id === 'ab' ? 'var(--slp-color-primary)' : undefined }}
            markerEnd="arrow-closed"
            label={
              <Button size="xs" variant="soft" onClick={() => remove(edge.id)}>
                Remove
              </Button>
            }
          >
            <Running />
          </Edge>
        )}
      </For>
    </Flow>
  );
}
