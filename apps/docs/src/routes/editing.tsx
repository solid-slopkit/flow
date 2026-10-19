import { Title } from '@solidjs/meta';
import { Example } from '../components/Example';
import { H2 } from '../components/Heading';
import { PropsTable } from '../components/PropsTable';
import { DocTable } from '../components/DocTable';
import Editing from '../examples/editing';
import editingCode from '../examples/editing.tsx?raw';
import Palette from '../examples/palette';
import paletteCode from '../examples/palette.tsx?raw';

export default function EditingPage() {
  return (
    <article class="docs-page">
      <Title>Selection and editing · flow · slopkit</Title>
      <p class="docs-eyebrow">flow</p>
      <h1>Selection and editing</h1>
      <p class="docs-lead">
        The Selection is the Nodes and Edges flagged <code>selected</code> in the app's data. Clicks, the selection box and the
        keyboard send <code>select</code> Changes like any other edit, and a focused Flow takes the keyboard and the clipboard.
      </p>

      <H2 id="selecting">Selecting, the keyboard and the clipboard</H2>
      <p>
        Click a Node or an Edge to select it; Shift, Ctrl or Meta click adds or takes out. Shift-drag empty space for the
        selection box. Then use the arrow keys (Shift for bigger steps), Delete, Escape, and copy and paste. Undo and Redo come
        from <code>createHistory</code>, which records one entry per gesture.
      </p>
      <Example component={Editing} code={editingCode} flow />
      <DocTable
        head={['Input', 'Does']}
        rows={[
          ['Click', 'Selects a Node or an Edge alone; on empty space, clears the Selection.'],
          ['Shift, Ctrl or Meta click', 'Adds to the Selection, or takes out.'],
          [
            'Shift-drag on empty space',
            'The selection box: the Nodes it overlaps (or holds, with selectionMode="full") and the Edges between them. With Ctrl or Meta too, adds.',
          ],
          ['Arrow keys', 'Move the selected Nodes 1 unit, with Shift 10.'],
          ['Delete, Backspace', 'Remove the Selection, with the Nodes nested in it and the Edges at it.'],
          ['Escape', 'Cancels a Connection being dragged, else clears the Selection.'],
          [
            'Copy, cut, paste',
            'Through the system clipboard: the selected Nodes, their nested Nodes and the Edges among them. Pasted at the pointer, with new ids, selected.',
          ],
        ]}
      />

      <H2 id="palette">Dragging from a palette</H2>
      <p>
        <code>&lt;FlowDraggable data&gt;</code> is an element outside the Flow that can be dragged onto any Flow in the page; that
        Flow's <code>onDrop</code> gets the data and the drop point in Flow coordinates. Drag an entry onto the Flow below.
      </p>
      <Example component={Palette} code={paletteCode} flow />

      <H2 id="props">Props</H2>
      <h3>On the Flow</h3>
      <PropsTable
        rows={[
          {
            name: 'selectionMode',
            type: "'partial' | 'full'",
            default: "'partial'",
            description: 'Which Nodes the selection box takes: any it overlaps, or only those wholly inside.',
          },
          {
            name: 'transformCopy',
            type: '(payload) => payload | undefined',
            description: 'Changes what copy and cut write; undefined writes nothing.',
          },
          {
            name: 'transformPaste',
            type: '(payload) => payload | undefined',
            description: 'Changes what a paste adds, after new ids and placing; undefined adds nothing.',
          },
          { name: 'onDrop', type: '(drop: { data, position }) => void', description: 'A <FlowDraggable> dropped on the Flow.' },
        ]}
      />
      <h3>&lt;FlowDraggable&gt;</h3>
      <PropsTable
        rows={[
          { name: 'data', type: 'T', default: 'required', description: "Handed to the Flow's onDrop." },
          { name: 'disabled', type: 'boolean', default: 'false', description: 'Nothing drags while true.' },
          { name: 'class, style', type: '', description: 'On its element, .slp-flow-draggable.' },
        ]}
      />
    </article>
  );
}
