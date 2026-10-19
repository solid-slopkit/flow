import { Title } from '@solidjs/meta';
import { CodeBlock } from '../components/CodeBlock';
import { Example } from '../components/Example';
import { H2 } from '../components/Heading';
import { PropsTable } from '../components/PropsTable';
import { DocTable } from '../components/DocTable';
import Keyboard from '../examples/keyboard';
import keyboardCode from '../examples/keyboard.tsx?raw';

const messagesCode = `<Flow
  state={flow}
  onChange={apply}
  messages={{
    flow: 'Diagramm',
    moved: ({ nodes }) => \`\${nodes.join(', ')} verschoben\`,
    selected: () => '', // says nothing
  }}
/>`;

export default function AccessibilityPage() {
  return (
    <article class="docs-page">
      <Title>Accessibility · flow · slopkit</Title>
      <p class="docs-eyebrow">flow</p>
      <h1>Accessibility</h1>
      <p class="docs-lead">
        A Flow works from the keyboard and tells a screen reader what it is and what happens in it: focus moves over the Nodes,
        Ports and Edges in spatial order, a Connection can be made without a pointer, and a live region announces every edit the
        Flow sends. Every string involved comes from <code>messages</code>, so the app can word or translate them.
      </p>

      <H2 id="keyboard">The keyboard</H2>
      <p>
        Click the Flow below (or Tab to it), then press Tab. Space selects the focused Node, the arrow keys move it. On a Port,
        Enter starts a Connection: Tab to a Port it may end on and press Enter. This example shows its live region in the corner;
        it is normally visible to screen readers only.
      </p>
      <Example component={Keyboard} code={keyboardCode} flow />
      <DocTable
        head={['Key', 'Does']}
        rows={[
          ['Tab on the Flow', 'Focuses the last item focused in it, else the first.'],
          [
            'Tab, Shift+Tab',
            'The next or previous item: each Node in reading order, then what can take focus inside it (its Ports, the app’s own controls), then the Edges. From the last item, on to the page after the Flow; from the first, back to the Flow.',
          ],
          ['Space or Enter on a Node or an Edge', 'Selects it alone; with Shift, Ctrl or Meta, adds it or takes it out.'],
          ['Enter on a Port', 'Starts a Connection from it, when it may start there.'],
          ['While connecting: Tab, Shift+Tab, arrows', 'Focus the next or previous Port it may end on, round the ends.'],
          ['While connecting: Enter', 'Connects to the focused Port: one connect Batch, as a drop would.'],
          ['While connecting: Escape', 'Cancels; focus goes back to the starting Port.'],
        ]}
      />
      <p>
        Focus is not the Selection: the arrow keys and Delete act on the Selection (see Selection and editing), so select a
        focused Node with Space before moving it. Focusing an item from the keyboard pans the Viewport to it when it is out of
        sight, and removing the focused item keeps focus in the Flow.
      </p>

      <H2 id="names">Roles and names</H2>
      <DocTable
        head={['Element', 'Role', 'Named by']}
        rows={[
          ['The Flow', 'application', 'its aria-label, else messages.flow ("Flow"); described by messages.instructions'],
          ['A Node', 'group, "node"', 'its aria-label, else its text content, else its id'],
          ['A Port', 'button, "port"', 'its aria-label, else messages.portLabel: "out on Start"'],
          ['An Edge', 'group, "edge"', 'its aria-label, else messages.edgeLabel: "From Start to End"'],
        ]}
      />
      <p>
        A Node's name is also how Edge names and announcements refer to it. Give a Node an <code>aria-label</code> when its text
        is long or says nothing on its own, such as an icon or a number.
      </p>

      <H2 id="announcements">Announcements</H2>
      <p>
        The live region says what each Batch the Flow sends does, before the app applies it. A gesture in phases, such as a drag,
        is announced once at its end. Each Batch says one thing, by priority: a removal, an addition, a Connection, a reconnected
        Edge, a move, then the Selection it leaves.
      </p>
      <DocTable
        head={['Changes', 'Default message']}
        rows={[
          ['remove', 'Removed Start and 2 edges'],
          ['add (a paste)', 'Added 2 nodes and 1 edge'],
          ['connect', 'Connected Start to End'],
          ['reconnect', 'Edge now runs from Start to Other'],
          ['move', 'Moved Start to 120, 40 — or Moved Start and End'],
          ['select', 'Selected Start and 1 edge — or Selection cleared'],
        ]}
      />

      <H2 id="messages">Messages</H2>
      <p>
        <code>messages</code> takes any of the Flow's strings over the English defaults: the labels, the instructions and each
        announcement. A message function that returns an empty string announces nothing.
      </p>
      <CodeBlock code={messagesCode} />

      <H2 id="props">Props</H2>
      <PropsTable
        rows={[
          { name: 'aria-label', type: 'string', default: 'messages.flow', description: 'On the Flow: its accessible name.' },
          {
            name: 'messages',
            type: 'Partial<FlowMessages>',
            description: 'On the Flow: replaces any label or announcement it writes for assistive technology.',
          },
          {
            name: 'aria-label',
            type: 'string',
            default: 'its text',
            description: 'On a Node: its name, in its own label, Edge names and announcements.',
          },
          { name: 'aria-label', type: 'string', default: 'messages.portLabel', description: 'On a Port: its name.' },
          { name: 'aria-label', type: 'string', default: 'messages.edgeLabel', description: 'On an Edge: its name.' },
        ]}
      />
    </article>
  );
}
