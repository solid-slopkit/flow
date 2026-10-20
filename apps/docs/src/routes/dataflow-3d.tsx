import { Title } from '@solidjs/meta';
import { CodeBlock } from '../components/CodeBlock';
import { Example } from '../components/Example';
import { H2 } from '../components/Heading';
import Dataflow3d from '../examples/dataflow-3d';
import dataflow3dCode from '../examples/dataflow-3d.tsx?raw';

const install = 'pnpm add three @types/three @solid-slopkit/threejs';

export default function Dataflow3dPage() {
  return (
    <article class="docs-page">
      <Title>3D dataflow · flow · slopkit</Title>
      <p class="docs-eyebrow">flow</p>
      <h1>3D dataflow</h1>
      <p class="docs-lead">
        Nodes are the app's own JSX, so they can hold real inputs and even a 3D scene. Here three input Nodes feed a viewer
        through Edges: pick a color, a shape and a zoom level, and the cloud follows. Drag the cloud to orbit it.
      </p>
      <Example component={Dataflow3d} code={dataflow3dCode} flow tall />

      <H2 id="values-along-edges">Values along Edges</H2>
      <p>
        Each input Node keeps its value in its <code>data</code>, and a change goes through an <code>update</code> Change like any
        other edit. The viewer reads what reaches each of its target Ports: the value of the Node at the other end of the Edge.
        Remove an Edge (select it and press Delete, or drag its end away) and the viewer falls back to a default; drag from an
        input's Port to connect it again. <code>canConnect</code> only lets a Port of one value type reach the same type.
      </p>

      <H2 id="inputs-in-nodes">Inputs in Nodes</H2>
      <p>
        Native inputs never start a Node drag. The color picker and the slider draw their own controls, so their body carries{' '}
        <code>data-flow-nodrag</code>: pointer gestures there go to the inputs and the scene, and the header drags the Node.
      </p>

      <H2 id="the-scene">The scene</H2>
      <p>
        The viewer is a <code>&lt;Canvas&gt;</code> from <code>@solid-slopkit/threejs</code>. The color, shape and zoom are props
        of its Scene components, so a new value updates the scene in place.
      </p>
      <CodeBlock lang="bash" code={install} />
    </article>
  );
}
