import { Title } from '@solidjs/meta';
import { Example } from '../components/Example';
import { H2 } from '../components/Heading';
import { PropsTable } from '../components/PropsTable';
import TypedPorts from '../examples/typed-ports';
import typedPortsCode from '../examples/typed-ports.tsx?raw';
import ConnectEnd from '../examples/connect-end';
import connectEndCode from '../examples/connect-end.tsx?raw';

export default function ConnectionsPage() {
  return (
    <article class="docs-page">
      <Title>Connections · flow · slopkit</Title>
      <p class="docs-eyebrow">flow</p>
      <h1>Connections</h1>
      <p class="docs-lead">
        A Connection is the gesture of dragging from a Port before it becomes an Edge. Dropped on a Port it may end on, it sends a{' '}
        <code>connect</code> Batch with the new Edge.
      </p>

      <H2 id="where">Where a Connection may end</H2>
      <p>
        While dragging, the line snaps to the nearest Port it may end on within <code>connectionRadius</code> pixels. Three rules
        decide, in order:
      </p>
      <ol>
        <li>
          <strong>Port kinds.</strong> A <code>source</code> Port becomes the Edge's Source and ends on a <code>target</code> or{' '}
          <code>both</code> Port; a <code>target</code> Port the other way round.
        </li>
        <li>
          <strong>
            <code>max</code>.
          </strong>{' '}
          A Port with as many Edges as its <code>max</code> takes no more, and starts none.
        </li>
        <li>
          <strong>
            <code>canConnect(source, target)</code>
          </strong>
          , the app's own rule: typed Ports, no duplicate Edges, anything else.
        </li>
      </ol>
      <p>
        Below, a number output connects only to number inputs, a text output only to text inputs, and each input takes one Edge.
        Try connecting the wrong colors: the line stays dashed.
      </p>
      <Example component={TypedPorts} code={typedPortsCode} flow />

      <H2 id="reconnecting">Reconnecting</H2>
      <p>
        Grab an Edge just outside the Port at its end and drag: dropping on another Port sends a <code>reconnect</code> Change,
        and dropping away from any Port removes the Edge. A press on the Port itself starts a new Connection.{' '}
        <code>&lt;Edge reconnectable={'{false}'}&gt;</code> turns this off. Try it on the Edges above.
      </p>

      <H2 id="empty-space">Dropping on empty space</H2>
      <p>
        A new Connection released away from every Node calls <code>onConnectEnd</code> with the drop point in Flow coordinates and
        the Port it started from, so the app can add a Node there. Drag from either Port of a Node into empty space.
      </p>
      <Example component={ConnectEnd} code={connectEndCode} flow />

      <H2 id="props">Props</H2>
      <PropsTable
        rows={[
          {
            name: 'canConnect',
            type: '(source: End, target: End) => boolean',
            description: 'Whether a Connection may end there, after Port kinds and max. Every Port by default.',
          },
          {
            name: 'connectionRadius',
            type: 'number',
            default: '20',
            description: 'How close, in screen pixels, a Connection snaps to a Port.',
          },
          {
            name: 'onConnectEnd',
            type: '(end: { position, source?, target? }) => void',
            description: 'A new Connection dropped on empty space; exactly one of source and target is set.',
          },
        ]}
      />
      <p>
        The new Edge is <code>{'{ id: createId(), source, target, data: undefined }'}</code>: set its <code>data</code> in{' '}
        <code>onChange</code> before applying it, if your Edges need some.
      </p>
    </article>
  );
}
