import { createSignal, createStore, For } from 'solid-js';
import { Button, Switch } from '@solid-slopkit/components';
import { applyChanges, Flow, Node, type FlowState, type Viewport } from '@solid-slopkit/flow';

export default function ViewportExample() {
  const [flow, setFlow] = createStore<FlowState<string, null>>({
    nodes: [
      { id: 'a', position: { x: 80, y: 120 }, data: 'Drag empty space to pan' },
      { id: 'b', position: { x: 360, y: 220 }, data: 'Wheel to zoom' },
    ],
    edges: [],
  });
  // A controlled Viewport: the Flow shows this one and reports every pan and zoom.
  const [viewport, setViewport] = createSignal<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [scrollPans, setScrollPans] = createSignal(false);
  const [interactive, setInteractive] = createSignal(true);

  return (
    <>
      <Flow
        state={flow}
        onChange={(batch) => applyChanges(setFlow, batch)}
        viewport={viewport()}
        onViewportChange={setViewport}
        scrollPans={scrollPans()}
        interactive={interactive()}
        minZoom={0.25}
        maxZoom={4}
      >
        <For each={flow.nodes}>
          {(node) => (
            <Node id={node.id} class="example-node">
              {node.data}
            </Node>
          )}
        </For>
      </Flow>
      <div class="docs-flow-toolbar">
        <Button size="xs" variant="soft" onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}>
          Reset
        </Button>
        <code>
          x {Math.round(viewport().x)} · y {Math.round(viewport().y)} · zoom {viewport().zoom.toFixed(2)}
        </code>
        <Switch size="xs" label="Scroll pans" checked={scrollPans()} onChange={setScrollPans} />
        <Switch size="xs" label="Editable" checked={interactive()} onChange={setInteractive} />
      </div>
    </>
  );
}
