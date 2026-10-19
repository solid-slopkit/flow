import { createStore, For } from 'solid-js';
import { applyChanges, Flow, FlowDraggable, Node, type FlowState } from '@solid-slopkit/flow';

type Item = { label: string };
const items: Item[] = [{ label: 'Task' }, { label: 'Note' }, { label: 'Milestone' }];

export default function Palette() {
  const [flow, setFlow] = createStore<FlowState<Item, null>>({ nodes: [], edges: [] });
  let next = 1;

  return (
    <>
      <Flow
        state={flow}
        onChange={(batch) => applyChanges(setFlow, batch)}
        // A palette entry dropped on the Flow: its data, and where in Flow coordinates.
        onDrop={({ data, position }) =>
          applyChanges(setFlow, {
            changes: [{ type: 'add', nodes: [{ id: `item-${next++}`, position, data: data as Item }], edges: [] }],
          })
        }
      >
        <For each={flow.nodes}>
          {(node) => (
            <Node id={node.id} class="example-node">
              {node.data.label}
            </Node>
          )}
        </For>
      </Flow>
      <div class="docs-flow-toolbar">
        <For each={items}>
          {(item) => (
            <FlowDraggable data={item} class="example-node">
              {item.label}
            </FlowDraggable>
          )}
        </For>
      </div>
    </>
  );
}
