import { Title } from '@solidjs/meta';
import { CodeBlock } from '../components/CodeBlock';
import { Example } from '../components/Example';
import { H2 } from '../components/Heading';
import { withBase } from '../base';
import QuickStart from '../examples/quick-start';
import quickStartCode from '../examples/quick-start.tsx?raw';
import examplesCss from '../examples/examples.css?raw';

const setup = `import { SlopkitUi } from '@solid-slopkit/components';
import '@solid-slopkit/components/styles/slopkit.css';
import '@solid-slopkit/components/styles/default-theme.css';
import '@solid-slopkit/flow/styles/flow.css';

export function Root() {
  return <SlopkitUi>{/* your app, with its Flows */}</SlopkitUi>;
}`;

export default function FlowOverview() {
  return (
    <article class="docs-page">
      <Title>flow · slopkit</Title>
      <p class="docs-eyebrow">flow</p>
      <h1>Overview</h1>
      <p class="docs-lead">
        <code>@solid-slopkit/flow</code>: SolidJS primitives for node-based editors and interactive diagrams. Your app keeps the
        Nodes and Edges in its own store and renders each Node as its own JSX; the Flow draws them, handles panning, dragging and
        connecting, and proposes every edit as a Batch of Changes for the app to apply.
      </p>

      <H2 id="quick-start">Quick start</H2>
      <p>
        Drag the Nodes, drag from a Port on the right of one to a Port on the left of another, pan by dragging empty space and
        zoom with the wheel.
      </p>
      <Example component={QuickStart} code={quickStartCode} flow />
      <p>
        Every edit arrives through <code>onChange</code> as a Batch; <code>applyChanges</code> applies it to the store in one
        write. Because the app applies each Batch, it can validate, record History or send edits to other clients in between.
      </p>

      <H2 id="installation">Installation</H2>
      <CodeBlock lang="bash" code="pnpm add solid-js @solidjs/web @solid-slopkit/components @solid-slopkit/flow" />
      <p>
        The Flow is built on <code>@solid-slopkit/components</code>: render it inside that package's provider,{' '}
        <code>&lt;SlopkitUi&gt;</code>, and load the components' stylesheets before the Flow's. Its colors follow the components
        theme.
      </p>
      <CodeBlock code={setup} />
      <p>The Flow draws Nodes as unstyled boxes, so their look is yours. The examples on these pages use these two classes:</p>
      <CodeBlock lang="css" code={examplesCss} />

      <H2 id="guides">Guides</H2>
      <ul>
        <li>
          <a href={withBase('/flow')}>Flow and Viewport</a>: the editor surface, panning and zooming.
        </li>
        <li>
          <a href={withBase('/nodes')}>Nodes</a>: dragging, snapping, nesting and resizing.
        </li>
        <li>
          <a href={withBase('/edges')}>Ports and Edges</a>: where Edges attach, Edge shapes, markers, labels and custom Edges.
        </li>
        <li>
          <a href={withBase('/connections')}>Connections</a>: making and moving Edges by dragging, and deciding where they may
          end.
        </li>
        <li>
          <a href={withBase('/editing')}>Selection and editing</a>: selecting, the keyboard, copy and paste, undo, and dragging
          from a palette.
        </li>
      </ul>

      <H2 id="for-agents">For coding agents</H2>
      <p>
        The package ships its own docs for agents: a reference per area, indexed in{' '}
        <code>node_modules/@solid-slopkit/flow/dist/source/llms.md</code>.
      </p>
    </article>
  );
}
