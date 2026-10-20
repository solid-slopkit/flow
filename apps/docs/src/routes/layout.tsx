import { Title } from '@solidjs/meta';
import { CodeBlock } from '../components/CodeBlock';
import { Example } from '../components/Example';
import { H2 } from '../components/Heading';
import { PropsTable } from '../components/PropsTable';
import LayoutExample from '../examples/layout';
import layoutCode from '../examples/layout.tsx?raw';

const install = 'pnpm add elkjs';

const worker = `import { elkInWorker, layout } from '@solid-slopkit/flow/layout';
import workerUrl from 'elkjs/lib/elk-worker.min.js?url';

const elk = elkInWorker(workerUrl);
const batch = await layout(flow.state(), { measured: flow, elk });`;

export default function LayoutPage() {
  return (
    <article class="docs-page">
      <Title>Layout · flow · slopkit</Title>
      <p class="docs-eyebrow">flow</p>
      <h1>Layout</h1>
      <p class="docs-lead">
        <code>layout</code> places a Flow's Nodes automatically with ELK, keeping Ports on their sides and children inside their
        Parents. It returns a Batch of Changes, which the app applies like any other edit, so a Layout can be undone.
      </p>
      <Example component={LayoutExample} code={layoutCode} flow />

      <H2 id="setup">Setup</H2>
      <p>
        Layout lives in its own entry, <code>@solid-slopkit/flow/layout</code>, and needs <code>elkjs</code>, an optional peer
        dependency. The main entry never imports either, so an app that doesn't lay out its Flow doesn't install or load ELK.
      </p>
      <CodeBlock code={install} lang="bash" />

      <H2 id="layout">layout(state, options)</H2>
      <p>
        Pass the Flow's state and, from <code>useFlow()</code>, its measurements, so ELK sees the sizes the Nodes are drawn at.
        The Batch moves each Node ELK placed elsewhere (relative to its Parent), resizes a Parent with a Declared size that no
        longer fits its children, and sets the <code>route</code> of each routed step Edge.
      </p>
      <PropsTable
        rows={[
          {
            name: 'options',
            type: 'Record<string, string>',
            description: "ELK's layout options, over the defaults: layered, left to right, orthogonal Edges.",
          },
          {
            name: 'measured',
            type: 'LayoutMeasurements',
            default: 'Declared only',
            description: 'Measured sizes and Ports: useFlow() fits.',
          },
          {
            name: 'route',
            type: '(edge) => boolean',
            default: 'routed-step Edges',
            description: "Which Edges get ELK's route as their route.",
          },
          {
            name: 'elk',
            type: 'ELK',
            default: 'bundled, on the page',
            description: 'The ELK instance to run, such as one in a Worker.',
          },
        ]}
      />

      <H2 id="worker">In a Web Worker</H2>
      <p>
        ELK is large and a Layout of a big Flow takes a while. <code>elkInWorker</code> runs it in a Web Worker from elkjs's
        worker script, so the page stays responsive and only ELK's small API loads with it.
      </p>
      <CodeBlock code={worker} lang="tsx" />

      <H2 id="routes">Routes</H2>
      <p>
        A routed step Edge draws its <code>route</code> while it still joins the Edge's ends and crosses no Node. Once a Node
        moves an end, or into its way, the Edge is routed again, round the Nodes.
      </p>
    </article>
  );
}
