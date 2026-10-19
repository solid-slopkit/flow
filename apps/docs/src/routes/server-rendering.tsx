import { Title } from '@solidjs/meta';
import { Example } from '../components/Example';
import { H2 } from '../components/Heading';
import ServerRendered from '../examples/server-rendered';
import serverRenderedCode from '../examples/server-rendered.tsx?raw';

export default function ServerRenderingPage() {
  return (
    <article class="docs-page">
      <Title>Server rendering · flow · slopkit</Title>
      <p class="docs-eyebrow">flow</p>
      <h1>Server rendering</h1>
      <p class="docs-lead">
        A Flow renders on the server and hydrates in the browser. Nodes always render at their positions. An Edge renders too when
        its geometry is in the data; otherwise it is drawn in the browser, once its Nodes are measured.
      </p>

      <H2 id="declared-geometry">Declared geometry</H2>
      <p>
        The server has no page to measure, so it places Edges from what the data declares. An Edge is drawn on the server when:
      </p>
      <ul>
        <li>
          the Nodes at both ends have a Declared size, <code>size</code>;
        </li>
        <li>
          every Port it names is declared in its Node's <code>ports</code>, with its <code>side</code> and, optionally, its{' '}
          <code>offset</code>. A Floating end needs no Port.
        </li>
      </ul>
      <p>
        <code>fitView</code> on the server also needs the Flow's own <code>width</code> and <code>height</code>, since there is no
        element to measure. In the browser the Flow measures its Nodes and Ports as usual, and the measurements take over from the
        declared values.
      </p>
      <p>This page is prerendered: the diagram below, Edges included, is in the HTML before any script runs.</p>
      <Example component={ServerRendered} code={serverRenderedCode} flow />
    </article>
  );
}
