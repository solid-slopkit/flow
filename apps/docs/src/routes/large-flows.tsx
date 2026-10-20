import { Title } from '@solidjs/meta';
import { CodeBlock } from '../components/CodeBlock';
import { Example } from '../components/Example';
import { H2 } from '../components/Heading';
import LargeFlowExample from '../examples/large-flow';
import largeFlowCode from '../examples/large-flow.tsx?raw';

const usage = `<Flow state={flow} onChange={apply} onlyRenderVisible={{ margin: 300 }}>
  …
</Flow>`;

export default function LargeFlowsPage() {
  return (
    <article class="docs-page">
      <Title>Large Flows · flow · slopkit</Title>
      <p class="docs-eyebrow">flow</p>
      <h1>Large Flows</h1>
      <p class="docs-lead">
        Nodes are the app's own DOM, so inputs, focus and CSS work as anywhere on the page. Past a few thousand of them, turn on{' '}
        <code>onlyRenderVisible</code>: the Flow then renders only the Nodes and Edges in sight. This one has 2,000 Nodes.
      </p>
      <Example component={LargeFlowExample} code={largeFlowCode} flow />

      <H2 id="in-sight">What is rendered</H2>
      <p>
        A Node or Edge is rendered when it is in sight, or within <code>margin</code> screen pixels of it (default 200). Nodes
        that are selected, dragged, focused or part of a Connection stay rendered wherever they are. Give Nodes a Declared{' '}
        <code>size</code> so the Flow knows where they are before it has ever rendered them.
      </p>
      <CodeBlock code={usage} lang="tsx" />

      <H2 id="kept">What is kept</H2>
      <p>
        A Node that leaves sight keeps its Measured size, its Ports and its name, so Edges, Connections, the MiniMap and{' '}
        <code>fitView</code> still place it. Its content is rendered afresh when it comes back, so keep anything that must last in
        the app's data.
      </p>

      <H2 id="keyboard">The keyboard and screen readers</H2>
      <p>
        Tab still moves over every Node, Port and Edge in spatial order: focusing one out of sight centres the Viewport on it
        first. A screen reader's own reading commands only reach what is rendered, which is why the mode is off by default.
      </p>
    </article>
  );
}
