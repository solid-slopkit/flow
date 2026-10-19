import { Title } from '@solidjs/meta';
import { Example } from '../components/Example';
import { H2 } from '../components/Heading';
import { PropsTable } from '../components/PropsTable';
import { DocTable } from '../components/DocTable';
import ViewportExample from '../examples/viewport';
import viewportCode from '../examples/viewport.tsx?raw';

export default function FlowPage() {
  return (
    <article class="docs-page">
      <Title>Flow and Viewport · flow · slopkit</Title>
      <p class="docs-eyebrow">flow</p>
      <h1>Flow and Viewport</h1>
      <p class="docs-lead">
        <code>&lt;Flow&gt;</code> is the editor surface: one Viewport with the app's Nodes and Edges drawn in it. It reads the
        app's <code>FlowState</code> and never writes it; every edit goes out as a Batch through <code>onChange</code>.
      </p>

      <H2 id="viewport">Viewport</H2>
      <p>
        The Viewport is the pan and zoom state, <code>{'{ x, y, zoom }'}</code>: a point <code>p</code> in Flow coordinates is
        drawn at <code>p * zoom + (x, y)</code>. It is the Flow's own state, so panning and zooming need no Batches. Leave it
        uncontrolled (with an optional <code>defaultViewport</code>), or control it as below. Drag empty space to pan, use the
        wheel to zoom around the pointer, or pinch with two fingers.
      </p>
      <Example component={ViewportExample} code={viewportCode} flow />
      <p>
        With <code>scrollPans</code> the wheel pans and Ctrl + wheel (or a trackpad pinch) zooms. With{' '}
        <code>interactive={'{false}'}</code> the Flow is read-only: no Node drags and no Batch is sent, but the Viewport still
        moves.
      </p>

      <H2 id="props">Props</H2>
      <PropsTable
        rows={[
          { name: 'state', type: 'FlowState<N, E>', default: 'required', description: "The app's data, usually a store." },
          {
            name: 'onChange',
            type: '(batch: Batch<N, E>) => void',
            description: 'Every edit, as a Batch. The app applies what it accepts.',
          },
          {
            name: 'createId',
            type: '() => string',
            default: 'crypto.randomUUID()',
            description: 'Ids for records the Flow creates: new Edges, pasted Nodes.',
          },
          {
            name: 'interactive',
            type: 'boolean',
            default: 'true',
            description: 'false is read-only. Panning and zooming still work.',
          },
          { name: 'viewport', type: 'Viewport', description: 'A controlled Viewport, reported through onViewportChange.' },
          {
            name: 'defaultViewport',
            type: 'Viewport',
            default: '{ x: 0, y: 0, zoom: 1 }',
            description: 'The starting Viewport when uncontrolled.',
          },
          {
            name: 'onViewportChange',
            type: '(viewport: Viewport) => void',
            description: 'Every Viewport change, controlled or not.',
          },
          { name: 'minZoom, maxZoom', type: 'number', default: '0.5, 2', description: 'The zoom always stays within these.' },
          { name: 'scrollPans', type: 'boolean', default: 'false', description: 'The wheel pans; Ctrl + wheel zooms.' },
          {
            name: 'fitView',
            type: 'boolean | FitViewOptions',
            default: 'false',
            description: 'Start fitted to the Nodes. With width and height, computed while rendering.',
          },
          {
            name: 'width, height',
            type: 'number',
            description: "The Flow's declared size, used until it is measured, and on the server.",
          },
          {
            name: 'aria-label',
            type: 'string',
            default: 'messages.flow',
            description: "The Flow's accessible name (see Accessibility).",
          },
          {
            name: 'messages',
            type: 'Partial<FlowMessages>',
            description: 'Replaces any label or announcement the Flow writes for assistive technology.',
          },
        ]}
      />
      <p>
        The Flow has no size of its own: give it one with CSS, or with <code>width</code> and <code>height</code>. The props for
        Nodes, Connections and editing are on their own pages.
      </p>

      <H2 id="use-flow">useFlow()</H2>
      <p>
        Inside a Flow's children, <code>useFlow()</code> returns that Flow's API. Each Flow has its own, so several Flows can
        share a page.
      </p>
      <DocTable
        head={['Member', 'Description']}
        rows={[
          [<code>viewport(), setViewport(v)</code>, 'The current Viewport, reactive; set it (the zoom is clamped).'],
          [<code>zoomTo(zoom, around?), zoomIn(), zoomOut()</code>, 'Zoom around a screen point, by default the centre.'],
          [
            <code>fitView(options?), fitBounds(rect, options?)</code>,
            'Show every Node, some Nodes, or a box, whole and centred.',
          ],
          [<code>screenToFlow(p), flowToScreen(p)</code>, 'Convert between pointer coordinates and Flow coordinates.'],
          [<code>state(), index(), emit(batch)</code>, 'The data, lookups by id, and sending a Batch to onChange.'],
          [
            <code>measuredSize(id), port(node, port), connection()</code>,
            'What the Flow has measured, and the Connection being dragged.',
          ],
        ]}
      />
    </article>
  );
}
