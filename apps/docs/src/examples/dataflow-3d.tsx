import { createStore, Errored, For, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { ColorPicker, Radio, Slider, Stack } from '@solid-slopkit/components';
import { applyChanges, Edge, Flow, Node, Port, type End, type FlowState } from '@solid-slopkit/flow';
import { Canvas, onFrame, T } from '@solid-slopkit/threejs';
import { OrbitControls } from '@solid-slopkit/threejs/controls';
import { Color, Euler, Matrix4, Quaternion, Vector3, WebGLRenderer, type Group, type InstancedMesh } from 'three';

type Shape = 'cubes' | 'pyramids' | 'spheres';
type Block =
  | { kind: 'color'; value: string }
  | { kind: 'shape'; value: Shape }
  | { kind: 'zoom'; value: number }
  | { kind: 'view' };

// A Port's id names the value it carries: "color-out" feeds "color-in", and so on.
const typeOf = (end: End) => end.port?.split('-')[0];
const colors: Record<string, string> = {
  shape: 'var(--slp-color-info)',
  zoom: 'var(--slp-color-warning)',
};
const inputs = ['color', 'shape', 'zoom'] as const;

export default function Dataflow3d() {
  const [flow, setFlow] = createStore<FlowState<Block, null>>({
    nodes: [
      { id: 'color', position: { x: 0, y: 0 }, data: { kind: 'color', value: '#7048e8' } },
      { id: 'shape', position: { x: 0, y: 300 }, data: { kind: 'shape', value: 'cubes' } },
      { id: 'zoom', position: { x: 0, y: 470 }, data: { kind: 'zoom', value: 1 } },
      { id: 'view', position: { x: 340, y: 120 }, data: { kind: 'view' } },
    ],
    edges: inputs.map((type) => ({
      id: type,
      source: { node: type, port: `${type}-out` },
      target: { node: 'view', port: `${type}-in` },
      data: null,
    })),
  });

  // An input's new value goes through the Flow's own Change, like any other edit.
  const set = (id: string, value: string | number) => {
    const node = flow.nodes.find((n) => n.id === id)!;
    applyChanges<Block, null>(setFlow, {
      changes: [{ type: 'update', item: 'node', id, from: { data: node.data }, to: { data: { ...node.data, value } as Block } }],
    });
  };

  // What reaches one of a Node's input Ports: the value of the Node at the other end of its Edge.
  const incoming = (node: string, type: string) => {
    const edge = flow.edges.find((e) => e.target.node === node && e.target.port === `${type}-in`);
    const source = edge && flow.nodes.find((n) => n.id === edge.source.node)?.data;
    return source && 'value' in source ? source.value : undefined;
  };

  // Ports and Edges are colored by the value type they carry; color ones by the color itself.
  const tint = (type: string, source?: string) => {
    if (type !== 'color') return colors[type];
    const data = flow.nodes.find((n) => n.id === (source ?? 'color'))?.data;
    return data?.kind === 'color' ? data.value : undefined;
  };

  const canConnect = (source: End, target: End) => typeOf(source) === typeOf(target);

  return (
    <Flow state={flow} onChange={(batch) => applyChanges(setFlow, batch)} canConnect={canConnect} fitView>
      <For each={flow.nodes}>
        {(node) => (
          <Node id={node.id} class="example-node example-dataflow-node">
            <div class="example-dataflow-head">{node.data.kind === 'view' ? 'Viewer' : 'Input'}</div>
            {/* Pointer gestures inside the body go to the inputs and the scene, not to dragging the Node. */}
            <div class="example-dataflow-body" data-flow-nodrag>
              <Show when={node.data.kind === 'color' && node.data}>
                {(data) => (
                  <ColorPicker
                    label="Color"
                    size="xs"
                    value={data().value}
                    onChange={(value) => set(node.id, value)}
                    swatches={['#e03131', '#f08c00', '#2f9e44', '#1971c2', '#7048e8']}
                    swatchesPerRow={5}
                  />
                )}
              </Show>
              <Show when={node.data.kind === 'shape' && node.data}>
                {(data) => (
                  <Radio.Group label="Shape" value={data().value} onChange={(value) => set(node.id, value)}>
                    <Stack gap={1}>
                      <Radio value="cubes" label="Cubes" />
                      <Radio value="pyramids" label="Pyramids" />
                      <Radio value="spheres" label="Spheres" />
                    </Stack>
                  </Radio.Group>
                )}
              </Show>
              <Show when={node.data.kind === 'zoom' && node.data}>
                {(data) => (
                  <Slider
                    label="Zoom level"
                    min={0.5}
                    max={3}
                    step={0.1}
                    value={data().value}
                    onChange={(value) => set(node.id, value)}
                    valueLabel={(value) => `${value}×`}
                  />
                )}
              </Show>
              <Show when={node.data.kind === 'view'}>
                <Cloud
                  color={incoming(node.id, 'color') as string | undefined}
                  shape={incoming(node.id, 'shape') as Shape | undefined}
                  zoom={incoming(node.id, 'zoom') as number | undefined}
                />
              </Show>
            </div>
            <Show
              when={node.data.kind === 'view'}
              fallback={
                <Port
                  id={`${node.data.kind}-out`}
                  side="right"
                  kind="source"
                  style={{ background: tint(node.data.kind, node.id) }}
                />
              }
            >
              <For each={inputs}>
                {(type, i) => (
                  <Port
                    id={`${type}-in`}
                    side="left"
                    kind="target"
                    max={1}
                    offset={(i() + 1) / (inputs.length + 1)}
                    style={{ background: tint(type) }}
                  />
                )}
              </For>
            </Show>
          </Node>
        )}
      </For>
      <For each={flow.edges}>
        {(edge) => (
          <Edge id={edge.id} class="example-dataflow-edge" style={{ color: tint(typeOf(edge.source)!, edge.source.node) }} />
        )}
      </For>
    </Flow>
  );
}

const COUNT = 160;

// The cloud's layout is made once: a position, rotation, scale and shade per model, scattered through a ball.
const random = (() => {
  let seed = 7;
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
})();
const matrices = Array.from({ length: COUNT }, () => {
  const direction = new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
  const position = direction.multiplyScalar(1 + Math.cbrt(random()) * 4);
  const rotation = new Quaternion().setFromEuler(new Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI));
  return new Matrix4().compose(position, rotation, new Vector3().setScalar(0.25 + random() * 0.35));
});
const shades = Array.from({ length: COUNT }, () => new Color().setScalar(0.45 + random() * 0.55));

function place(mesh: InstancedMesh) {
  matrices.forEach((matrix, i) => {
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, shades[i]);
  });
}

/** The 3D view: a slowly turning cloud of the chosen models in the chosen color, seen at the chosen zoom. */
function Cloud(props: { color?: string; shape?: Shape; zoom?: number }) {
  return (
    <div class="example-dataflow-scene">
      {/* Without WebGL (an old browser, a test environment) the renderer throws: show a note instead of the scene. */}
      <Errored fallback={<p class="example-dataflow-hint">This browser can't draw 3D</p>}>
        <Canvas renderer={(canvas) => new WebGLRenderer({ canvas, antialias: true, alpha: true })}>
          <T.PerspectiveCamera active position={[0, 0, 13]} fov={45} zoom={props.zoom ?? 1} />
          <OrbitControls enableZoom={false} enablePan={false} enableDamping />
          <T.AmbientLight intensity={0.6} />
          <T.DirectionalLight position={[5, 6, 8]} intensity={2.5} />
          <T.DirectionalLight position={[-6, -3, -4]} intensity={1.2} color="#9ec5ff" />
          <Spinning>
            <For each={['cubes', 'pyramids', 'spheres'] as const}>
              {(shape) => (
                <T.InstancedMesh args={[undefined, undefined, COUNT]} ref={place} visible={props.shape === shape}>
                  <Show when={shape === 'cubes'}>
                    <T.BoxGeometry />
                  </Show>
                  <Show when={shape === 'pyramids'}>
                    <T.ConeGeometry args={[0.75, 1.2, 4]} />
                  </Show>
                  <Show when={shape === 'spheres'}>
                    <T.SphereGeometry args={[0.6, 24, 16]} />
                  </Show>
                  <T.MeshStandardMaterial color={props.color ?? '#868e96'} roughness={0.35} metalness={0.25} />
                </T.InstancedMesh>
              )}
            </For>
          </Spinning>
        </Canvas>
      </Errored>
      <Show when={!props.shape}>
        <p class="example-dataflow-hint">Connect a shape</p>
      </Show>
    </div>
  );
}

function Spinning(props: { children: JSX.Element }) {
  let group!: Group;
  onFrame((canvas, delta) => {
    group.rotation.y += delta * 0.3;
    group.rotation.x = Math.sin(canvas.time * 0.4) * 0.25;
  });
  return <T.Group ref={(g) => (group = g)}>{props.children}</T.Group>;
}
