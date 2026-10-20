import { Title } from '@solidjs/meta';
import { Example } from '../components/Example';
import { H2 } from '../components/Heading';
import { PropsTable } from '../components/PropsTable';
import BuiltInUi from '../examples/built-in-ui';
import builtInUiCode from '../examples/built-in-ui.tsx?raw';
import Grid from '../examples/grid';
import gridCode from '../examples/grid.tsx?raw';

export default function BuiltInUiPage() {
  return (
    <article class="docs-page">
      <Title>Built-in UI · flow · slopkit</Title>
      <p class="docs-eyebrow">flow</p>
      <h1>Built-in UI</h1>
      <p class="docs-lead">
        Add a <code>&lt;Background&gt;</code>, <code>&lt;Controls&gt;</code> and a <code>&lt;MiniMap&gt;</code> to a Flow as
        children, next to its Nodes and Edges. Each draws in its own layer, outside the Viewport's transform: a Background under
        it, Controls and a MiniMap over it in a corner. They are built from <code>@solid-slopkit/components</code> and follow the
        theme.
      </p>
      <Example component={BuiltInUi} code={builtInUiCode} flow />

      <H2 id="background">Background</H2>
      <p>
        A pattern of dots, lines or crosses repeated every <code>gap</code> in Flow coordinates, so it pans and zooms with the
        Viewport. It takes no pointer events: dragging it pans, like any empty space. Several Backgrounds stack, the first lowest,
        so fine lines under coarse ones make a grid with major lines.
      </p>
      <Example component={Grid} code={gridCode} flow />
      <PropsTable
        rows={[
          { name: 'variant', type: "'dots' | 'lines' | 'cross'", default: "'dots'", description: 'The pattern.' },
          { name: 'gap', type: 'number | [number, number]', default: '20', description: 'Spacing in Flow coordinates.' },
          {
            name: 'size',
            type: 'number',
            default: '2 dots, 6 cross',
            description: "A dot's diameter or a cross's size, in Flow coordinates.",
          },
          { name: 'lineWidth', type: 'number', default: '1', description: 'Stroke width of lines and crosses, in pixels.' },
          { name: 'offset', type: 'number | [number, number]', default: '0', description: 'Shifts the grid.' },
          { name: 'color', type: 'string', default: '--slp-flow-pattern-color', description: "The pattern's color." },
        ]}
      />

      <H2 id="controls">Controls</H2>
      <p>
        Buttons to zoom in, zoom out, fit the view and lock editing. Locking is the Flow's own state,{' '}
        <code>useFlow().locked()</code>: while locked the Flow is read-only, as with <code>interactive={'{false}'}</code>, but it
        still pans and zooms. Pass more buttons as children, usually <code>ActionIcon</code>s; they can call{' '}
        <code>useFlow()</code>.
      </p>
      <PropsTable
        rows={[
          {
            name: 'position',
            type: "'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'",
            default: "'bottom-left'",
            description: 'Its corner.',
          },
          {
            name: 'orientation',
            type: "'vertical' | 'horizontal'",
            default: "'vertical'",
            description: 'How the buttons line up.',
          },
          { name: 'showZoom, showFitView, showLock', type: 'boolean', default: 'true', description: 'Which buttons it shows.' },
          { name: 'fitViewOptions', type: 'FitViewOptions', description: 'What fit view fits, and its padding.' },
          { name: 'children', type: 'JSX.Element', description: 'More buttons, after the built-in ones.' },
        ]}
      />

      <H2 id="minimap">MiniMap</H2>
      <p>
        An overview of every Node with a size, and the visible area. Drag in it to pan, press outside the visible area to centre
        the view there, and use the wheel to zoom. It takes keyboard focus after Controls: the arrow keys pan, <code>+</code> and{' '}
        <code>-</code> zoom.
      </p>
      <PropsTable
        rows={[
          { name: 'position', type: 'PanelPosition', default: "'bottom-right'", description: 'Its corner.' },
          { name: 'width, height', type: 'number', default: '200, 150', description: 'In pixels.' },
          {
            name: 'nodeColor, nodeClass',
            type: 'string | (node) => string | undefined',
            description: "Each Node's fill and class.",
          },
          { name: 'pannable, zoomable', type: 'boolean', default: 'true', description: 'Whether it pans and zooms the Flow.' },
        ]}
      />
      <p>
        Input on Controls and a MiniMap is their own: a press on one never pans the Flow or changes the Selection, and Delete on a
        focused button removes nothing. Their labels come from the Flow's <code>messages</code>.
      </p>
    </article>
  );
}
