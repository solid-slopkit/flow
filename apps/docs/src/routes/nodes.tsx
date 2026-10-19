import { Title } from '@solidjs/meta';
import { Example } from '../components/Example';
import { H2 } from '../components/Heading';
import { PropsTable } from '../components/PropsTable';
import Dragging from '../examples/dragging';
import draggingCode from '../examples/dragging.tsx?raw';
import Nesting from '../examples/nesting';
import nestingCode from '../examples/nesting.tsx?raw';
import Resizing from '../examples/resizing';
import resizingCode from '../examples/resizing.tsx?raw';

export default function NodesPage() {
  return (
    <article class="docs-page">
      <Title>Nodes · flow · slopkit</Title>
      <p class="docs-eyebrow">flow</p>
      <h1>Nodes</h1>
      <p class="docs-lead">
        A <code>&lt;Node&gt;</code> draws one record of the Flow's state with the app's own JSX as its content. The Flow measures
        it, so its content sets its size unless the record declares one.
      </p>

      <H2 id="dragging">Dragging</H2>
      <p>
        Dragging a Node sends <code>move</code> Batches in phases (<code>start</code>, <code>update</code>, <code>end</code>), and
        dragging a selected Node drags the whole Selection. Snapping to a grid and alignment guides are Flow props.{' '}
        <code>draggable: false</code> in the record pins a Node, and <code>dragHandle</code> limits where a drag may start.
      </p>
      <Example component={Dragging} code={draggingCode} flow />

      <H2 id="nesting">Nesting</H2>
      <p>
        A Node with a <code>parent</code> is nested in that Node: its position is relative to its Parent, it moves with it, and it
        is drawn above it. The app renders every Node flat, so changing a Parent never moves DOM. With <code>reparentOnDrop</code>
        , dropping Nodes onto another Node nests them, and <code>keepInParent</code> keeps a Node inside its Parent.
      </p>
      <Example component={Nesting} code={nestingCode} flow />

      <H2 id="resizing">Resizing</H2>
      <p>
        <code>&lt;NodeResizer&gt;</code> puts handles on the edges and corners of its Node while it is selected. Dragging one
        sends <code>resize</code> Batches that set the Declared size. Click a Node to select it.
      </p>
      <Example component={Resizing} code={resizingCode} flow />

      <H2 id="props">Props</H2>
      <h3>&lt;Node&gt;</h3>
      <PropsTable
        rows={[
          {
            name: 'id',
            type: 'string',
            default: 'required',
            description: "The record's id. It doesn't change for the life of the Node.",
          },
          {
            name: 'dragHandle',
            type: 'string',
            description: 'A selector: dragging starts only on matching elements inside the Node.',
          },
          {
            name: 'keepInParent',
            type: 'boolean',
            default: 'false',
            description: 'Keep the Node inside its Parent while dragging.',
          },
          {
            name: 'aria-label',
            type: 'string',
            default: 'its text',
            description: 'Its name for assistive technology and announcements (see Accessibility).',
          },
          { name: 'class, style', type: '', description: 'On the Node element, .slp-flow-node.' },
        ]}
      />
      <h3>&lt;NodeResizer&gt;</h3>
      <PropsTable
        rows={[
          { name: 'minWidth, minHeight', type: 'number', default: '10', description: 'The smallest size.' },
          { name: 'maxWidth, maxHeight', type: 'number', description: 'The largest size. Unlimited by default.' },
          {
            name: 'keepAspectRatio',
            type: 'boolean',
            default: 'false',
            description: 'Resize keeping the width-to-height ratio.',
          },
          { name: 'visible', type: 'boolean', default: 'selected', description: 'Whether the handles show.' },
        ]}
      />
      <h3>On the Flow</h3>
      <PropsTable
        rows={[
          {
            name: 'snapToGrid',
            type: 'number | [number, number]',
            description: 'Dragged Nodes snap to a grid with this spacing.',
          },
          {
            name: 'alignmentGuides',
            type: 'boolean | { threshold? }',
            default: 'false',
            description: "Lines to other Nodes' edges and centres, and snapping to them within threshold pixels (6).",
          },
          {
            name: 'reparentOnDrop',
            type: 'boolean | (node, parent) => boolean',
            default: 'false',
            description: 'Dropping Nodes onto a Node nests them in it; a function decides per Node and Parent.',
          },
        ]}
      />
    </article>
  );
}
