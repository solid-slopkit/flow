import { Title } from '@solidjs/meta';
import { Example } from '../components/Example';
import { H2 } from '../components/Heading';
import { PropsTable } from '../components/PropsTable';
import { DocTable } from '../components/DocTable';
import EdgeShapes from '../examples/edge-shapes';
import edgeShapesCode from '../examples/edge-shapes.tsx?raw';
import CustomEdge from '../examples/custom-edge';
import customEdgeCode from '../examples/custom-edge.tsx?raw';

export default function EdgesPage() {
  return (
    <article class="docs-page">
      <Title>Ports and Edges · flow · slopkit</Title>
      <p class="docs-eyebrow">flow</p>
      <h1>Ports and Edges</h1>
      <p class="docs-lead">
        A <code>&lt;Port&gt;</code> is a point on a Node where Edges attach. An <code>&lt;Edge&gt;</code> draws one Edge record as
        an SVG line between its Source and Target, under the Nodes, with an optional HTML label above them.
      </p>

      <H2 id="ports">Ports</H2>
      <p>
        Render <code>&lt;Port&gt;</code> inside a Node's content. Its id is unique within its Node only, so Node templates reuse
        names like <code>"in"</code> and <code>"out"</code>. It sits on its <code>side</code>, at an <code>offset</code> along it,
        and the Flow measures where it ends up. Until then (and on the server), an Edge uses the Port declared in the record's{' '}
        <code>ports</code>. An Edge end without a Port is a Floating end: it attaches to the Node's outline.
      </p>
      <PropsTable
        rows={[
          { name: 'id', type: 'string', default: 'required', description: 'Unique within the Node.' },
          {
            name: 'side',
            type: "'top' | 'right' | 'bottom' | 'left'",
            default: 'declared, else nearest',
            description: 'Which side it sits on, and which way its Edges leave.',
          },
          {
            name: 'offset',
            type: 'number',
            default: '0.5',
            description: 'Where along the side, as a fraction from its top or left corner.',
          },
          {
            name: 'kind',
            type: "'source' | 'target' | 'both'",
            default: "'both'",
            description: 'Which Edge ends it accepts (see Connections).',
          },
          { name: 'max', type: 'number', description: 'The most Edges it accepts. Unlimited by default.' },
          {
            name: 'aria-label',
            type: 'string',
            default: 'messages.portLabel',
            description: 'Its name for assistive technology; Enter on it starts a Connection (see Accessibility).',
          },
        ]}
      />

      <H2 id="shapes">Edge shapes, markers and labels</H2>
      <p>
        An Edge's shape comes from its record's <code>shape</code>, or the <code>shape</code> prop: a built-in name or the app's
        own function from the two ends to the path and label point. Markers follow the Edge's color, so recolor an Edge with{' '}
        <code>color</code>. A label is the app's HTML, centred on the line.
      </p>
      <Example component={EdgeShapes} code={edgeShapesCode} flow />

      <H2 id="custom-edges">Custom Edges</H2>
      <p>
        Children replace the default line. They are SVG drawn inside the Edge, and read it through <code>useEdge()</code>: its
        path, label point, ends and Selection. <code>&lt;EdgePath /&gt;</code> draws the default line to build on.
      </p>
      <Example component={CustomEdge} code={customEdgeCode} flow />

      <H2 id="props">Props</H2>
      <PropsTable
        rows={[
          { name: 'id', type: 'string', default: 'required', description: "The record's id." },
          {
            name: 'shape',
            type: 'EdgeShapeName | EdgeShape',
            default: "record's, else 'bezier'",
            description: 'bezier, straight, step, smooth-step, or a shape function.',
          },
          {
            name: 'markerStart, markerEnd',
            type: "'arrow' | 'arrow-closed' | { type, size? }",
            description: 'A marker at that end, sized in stroke widths (8).',
          },
          { name: 'label', type: 'JSX.Element', description: 'HTML centred on the label point, above the Nodes.' },
          {
            name: 'reconnectable',
            type: 'boolean',
            default: 'true',
            description: 'Dragging an end moves it to another Port (see Connections).',
          },
          {
            name: 'aria-label',
            type: 'string',
            default: 'messages.edgeLabel',
            description: 'Its name for assistive technology.',
          },
          { name: 'children', type: 'JSX.Element', description: 'SVG drawn instead of the default line.' },
        ]}
      />
      <DocTable
        head={['useEdge()', 'Description']}
        rows={[
          [<code>id(), edge(), selected()</code>, 'The id, the record and its Selection.'],
          [<code>source(), target()</code>, 'The ends in Flow coordinates, with the side each leaves.'],
          [<code>geometry()</code>, "The shape's output: the path d and the label point."],
          [<code>markerStart(), markerEnd()</code>, 'url(#…) of the markers, for a custom path.'],
        ]}
      />
    </article>
  );
}
