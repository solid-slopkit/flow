import { captureArtifact } from '../../test/capture';
import { flush } from 'solid-js';
import { afterEach, describe, expect, test } from 'vitest';

import { renderEditor, type EditorOptions } from '../../test/editor';
import type { FlowNode, FlowState } from '../model/model';
import { Port } from '../port/Port';

// jsdom has no layout: Nodes are placed from their Declared sizes, and nothing pans into view.
const node = (id: string, x: number, y: number, fields: Partial<FlowNode> = {}): FlowNode => ({
  id,
  position: { x, y },
  size: { width: 100, height: 50 },
  ports: [
    { id: 'in', side: 'left' },
    { id: 'out', side: 'right' },
  ],
  data: null,
  ...fields,
});

// In state order c, a, b; in spatial order a, b, c.
const state: FlowState = {
  nodes: [node('c', 0, 200), node('a', 0, 0), node('b', 300, 0)],
  edges: [
    { id: 'bc', source: { node: 'b', port: 'out' }, target: { node: 'c', port: 'in' }, data: null },
    { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' }, data: null },
  ],
};

const content = (record: FlowNode) => (
  <div>
    {record.id}
    <Port id="in" side="left" />
    <Port id="out" side="right" />
  </div>
);

type Modifiers = { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean };

function editor(initial: FlowState = state, options: EditorOptions = {}) {
  let ids = 0;
  const result = renderEditor(initial, { content, ...options, flow: { createId: () => `e${++ids}`, ...options.flow } });
  flush();
  const key = (key: string, modifiers: Modifiers = {}, target: Element = document.activeElement ?? result.root()) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers });
    target.dispatchEvent(event);
    flush();
    return event;
  };
  const port = (node: string, port: string) => result.nodeElement(node).querySelector<HTMLElement>(`[data-flow-port="${port}"]`)!;
  const focused = () => {
    const active = document.activeElement;
    if (!active) return undefined;
    if (active.matches('[data-flow-port]')) {
      return `${active.closest('[data-flow-node]')!.getAttribute('data-flow-node')}.${active.getAttribute('data-flow-port')}`;
    }
    return active.getAttribute('data-flow-node') ?? active.getAttribute('data-flow-edge') ?? active.className;
  };
  const live = () => result.root().querySelector('.slp-flow-live')!.textContent!.replace(/ $/, '');
  const selected = () => result.state.nodes.filter((record) => record.selected).map((record) => record.id);
  return { ...result, key, port, focused, live, selected };
}

afterEach(() => {
  for (const element of document.querySelectorAll('[data-test-outside]')) element.remove();
});

describe('roles and labels', () => {
  test('the Flow is an application, named and described by its messages', () => {
    const { root } = editor();
    expect(root()).toHaveAttribute('role', 'application');
    expect(root()).toHaveAttribute('aria-label', 'Flow');
    const description = document.getElementById(root().getAttribute('aria-describedby')!);
    expect(description?.textContent).toMatch(/^Tab and Shift\+Tab move between nodes/);
  });

  test('Nodes, Ports and Edges are named from the Nodes’ text content', () => {
    const { nodeElement, edgeElement, port } = editor();
    expect(nodeElement('a')).toHaveAttribute('role', 'group');
    expect(nodeElement('a')).toHaveAttribute('aria-roledescription', 'node');
    expect(nodeElement('a')).toHaveAttribute('aria-label', 'a');
    expect(nodeElement('a')).toHaveAttribute('tabindex', '-1');
    expect(port('a', 'out')).toHaveAttribute('role', 'button');
    expect(port('a', 'out')).toHaveAttribute('aria-roledescription', 'port');
    expect(port('a', 'out')).toHaveAttribute('aria-label', 'out on a');
    expect(edgeElement('ab')).toHaveAttribute('aria-roledescription', 'edge');
    expect(edgeElement('ab')).toHaveAttribute('aria-label', 'From a to b');
  });

  test('a Node’s name follows its text, unless it has an aria-label', () => {
    const { nodeElement, edgeElement, setState } = editor(state, {
      content: (record) => <div>{(record.data as string | null) ?? record.id}</div>,
      node: (record) => ({ 'aria-label': record.id === 'b' ? 'Bee' : undefined }),
    });
    expect(nodeElement('b')).toHaveAttribute('aria-label', 'Bee');
    setState((draft) => {
      draft.nodes[1]!.data = 'Start';
    });
    flush();
    // The MutationObserver reports after the change.
    return Promise.resolve().then(() => {
      flush();
      expect(nodeElement('a')).toHaveAttribute('aria-label', 'Start');
      expect(edgeElement('ab')).toHaveAttribute('aria-label', 'From Start to Bee');
    });
  });

  test('aria-label props and messages replace the defaults', () => {
    const { root, nodeElement, edgeElement, port } = editor(state, {
      flow: {
        'aria-label': 'Pipeline',
        messages: { node: 'step', edgeLabel: ({ source, target }) => `${source} → ${target}`, portLabel: ({ port }) => port },
      },
      edge: (record) => ({ 'aria-label': record.id === 'bc' ? 'Second link' : undefined }),
    });
    expect(root()).toHaveAttribute('aria-label', 'Pipeline');
    expect(nodeElement('a')).toHaveAttribute('aria-roledescription', 'step');
    expect(edgeElement('ab')).toHaveAttribute('aria-label', 'a → b');
    expect(edgeElement('bc')).toHaveAttribute('aria-label', 'Second link');
    expect(port('a', 'in')).toHaveAttribute('aria-label', 'in');
  });

  test('a Port in a read-only Flow is disabled', () => {
    const { port } = editor(state, { flow: { interactive: false } });
    expect(port('a', 'out')).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('roving focus', () => {
  test('Tab moves through the Nodes in spatial order, each with its Ports, then the Edges', () => {
    const { root, key, focused } = editor();
    root().focus();
    const seen: (string | undefined)[] = [];
    for (let i = 0; i < 11; i++) {
      key('Tab');
      seen.push(focused());
    }
    expect(seen).toEqual(['a', 'a.in', 'a.out', 'b', 'b.in', 'b.out', 'c', 'c.in', 'c.out', 'ab', 'bc']);
  });

  test('Shift+Tab moves back, and from the first item to the Flow itself', () => {
    const { nodeElement, key, focused } = editor();
    nodeElement('b').focus();
    key('Tab', { shiftKey: true });
    expect(focused()).toBe('a.out');
    nodeElement('a').focus();
    const event = key('Tab', { shiftKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(focused()).toBe('slp-flow');
    // From the Flow itself, Shift+Tab is the page's.
    expect(key('Tab', { shiftKey: true }).defaultPrevented).toBe(false);
  });

  test('Tab from the Flow resumes at the last item focused in it', () => {
    const { root, nodeElement, key, focused } = editor();
    nodeElement('c').focus();
    root().focus();
    key('Tab');
    expect(focused()).toBe('c');
  });

  test('Tab from the last item leaves the Flow for what follows it in the page', () => {
    const { root, edgeElement, key } = editor();
    const after = document.createElement('button');
    after.setAttribute('data-test-outside', '');
    root().after(after);
    edgeElement('bc')!.focus();
    key('Tab');
    expect(document.activeElement).toBe(after);
  });

  test('the app’s own controls inside a Node are in the order, after its Ports', () => {
    const { nodeElement, key, focused } = editor(state, {
      content: (record) => (
        <div>
          <Port id="in" side="left" />
          <input aria-label={`${record.id} name`} />
        </div>
      ),
    });
    nodeElement('a').focus();
    key('Tab');
    key('Tab');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('a name');
    key('Tab');
    expect(focused()).toBe('b');
  });

  test('an Edge that isn’t drawn takes no focus', () => {
    const { edgeElement } = editor({
      ...state,
      edges: [...state.edges, { id: 'gone', source: { node: 'a' }, target: { node: 'nowhere' }, data: null }],
    });
    expect(edgeElement('gone')).not.toHaveAttribute('tabindex');
  });

  test('moving focus re-runs nothing', async () => {
    const { root, key } = editor();
    root().focus();
    const { artifact } = await captureArtifact(
      () => {
        for (let i = 0; i < 5; i++) key('Tab');
      },
      { scenario: 'tab' },
    );
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(0);
  });
});

describe('selecting from the keyboard', () => {
  test('Space or Enter selects the focused Node or Edge alone; with Shift it toggles', () => {
    const { nodeElement, edgeElement, key, selected, state: current } = editor();
    nodeElement('a').focus();
    key(' ');
    expect(selected()).toEqual(['a']);
    nodeElement('b').focus();
    key(' ', { shiftKey: true });
    expect(selected()).toEqual(['a', 'b']);
    key('Enter', { shiftKey: true });
    expect(selected()).toEqual(['a']);
    edgeElement('ab')!.focus();
    key('Enter');
    expect(selected()).toEqual([]);
    expect(current.edges.find((edge) => edge.id === 'ab')?.selected).toBe(true);
  });

  test('Space inside the app’s field is the field’s', () => {
    const { nodeElement, key, selected } = editor(state, { content: () => <input /> });
    const input = nodeElement('a').querySelector('input')!;
    input.focus();
    expect(key(' ').defaultPrevented).toBe(false);
    expect(selected()).toEqual([]);
  });

  test('removing the focused Node keeps focus in the Flow', () => {
    const { nodeElement, key, focused, state: current } = editor();
    nodeElement('a').focus();
    key(' ');
    key('Delete');
    expect(current.nodes.map((record) => record.id)).toEqual(['c', 'b']);
    expect(focused()).toBe('slp-flow');
  });
});

describe('connecting from the keyboard', () => {
  test('Enter on a Port starts a Connection, Tab picks a Port it may end on, Enter connects', () => {
    const { port, key, focused, api, batches, live } = editor();
    port('a', 'out').focus();
    key('Enter');
    expect(api().connection()).toMatchObject({ from: { node: 'a', port: 'out' }, to: undefined });
    expect(port('a', 'out')).toHaveAttribute('data-connecting');
    expect(live()).toMatch(/^Connecting from out on a\. 5 ports to connect to/);
    key('Tab');
    // Only Ports it may end on: past a.out to b's.
    expect(focused()).toBe('b.in');
    expect(api().connection()?.to).toEqual({ node: 'b', port: 'in' });
    expect(port('b', 'in')).toHaveAttribute('data-connection-target');
    key('Enter');
    expect(api().connection()).toBeUndefined();
    expect(batches.at(-1)).toEqual({
      changes: [
        {
          type: 'connect',
          edge: { id: 'e1', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' }, data: undefined },
        },
      ],
    });
    expect(live()).toBe('Connected a to b');
  });

  test('Tab and the arrow keys go round the Ports it may end on, Shift+Tab backwards', () => {
    const { port, key, focused } = editor(state, { flow: { canConnect: (_, target) => target.port === 'in' } });
    port('a', 'out').focus();
    key('Enter');
    // From the starting Port, on to the first target after it.
    key('ArrowDown');
    expect(focused()).toBe('b.in');
    key('Tab');
    expect(focused()).toBe('c.in');
    key('ArrowRight');
    expect(focused()).toBe('a.in');
    key('Tab', { shiftKey: true });
    expect(focused()).toBe('c.in');
    key('ArrowUp');
    expect(focused()).toBe('b.in');
  });

  test('Escape cancels and returns focus to the starting Port', () => {
    const { port, key, focused, api, batches, live } = editor();
    port('a', 'out').focus();
    key('Enter');
    key('Tab');
    const count = batches.length;
    key('Escape');
    expect(api().connection()).toBeUndefined();
    expect(focused()).toBe('a.out');
    expect(live()).toBe('Connection cancelled');
    expect(batches).toHaveLength(count);
  });

  test('Enter with no target focused connects nothing; focus leaving the Flow cancels', () => {
    const { root, port, key, api, batches } = editor();
    port('a', 'out').focus();
    key('Enter');
    key('Enter');
    expect(batches).toEqual([]);
    expect(api().connection()).toBeDefined();
    const outside = document.createElement('button');
    outside.setAttribute('data-test-outside', '');
    root().after(outside);
    outside.focus();
    flush();
    expect(api().connection()).toBeUndefined();
  });

  test('not from a Port at its max, nor in a read-only Flow', () => {
    const full = editor(state, { content: () => <Port id="out" side="right" max={1} /> });
    full.port('a', 'out').focus();
    full.key('Enter');
    expect(full.api().connection()).toBeUndefined();
    full.unmount();
    const readOnly = editor(state, { flow: { interactive: false } });
    readOnly.port('a', 'out').focus();
    readOnly.key('Enter');
    expect(readOnly.api().connection()).toBeUndefined();
  });

  test('moving between targets re-runs only the Ports it leaves and reaches, and the line', async () => {
    const { port, key } = editor();
    port('a', 'out').focus();
    key('Enter');
    key('Tab');
    const { artifact } = await captureArtifact(() => key('Tab'), { scenario: 'keyboard-connection-target' });
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(0, { scope: /^(node|edge):/ });
    expect(artifact).toStayWithinRerunBudget(3);
  });
});

describe('announcements', () => {
  test('moves, removals and the Selection from the keyboard are announced', () => {
    const { nodeElement, key, live } = editor();
    nodeElement('a').focus();
    key(' ');
    expect(live()).toBe('Selected a');
    key('ArrowRight');
    expect(live()).toBe('Moved a to 1, 0');
    key('ArrowRight', { shiftKey: true });
    expect(live()).toBe('Moved a to 11, 0');
    key('Delete');
    expect(live()).toBe('Removed a and 1 edge');
    key('Escape');
    // Nothing selected, nothing sent: the last announcement stays.
    expect(live()).toBe('Removed a and 1 edge');
  });

  test('the same message twice in a row is said again', () => {
    const { root, nodeElement, key } = editor(state, { flow: { messages: { moved: () => 'Moved' } } });
    nodeElement('a').focus();
    key(' ');
    const text = () => root().querySelector('.slp-flow-live')!.textContent;
    key('ArrowRight');
    const first = text();
    key('ArrowRight');
    expect(text()).not.toBe(first);
    expect(text()!.trim()).toBe('Moved');
  });

  test('a gesture in phases is announced once, at its end, from all its Changes', () => {
    const { api, live } = editor();
    const move = (x: number) => ({ type: 'move' as const, node: 'b', from: { x: 300, y: 0 }, to: { x, y: 0 } });
    api().emit({ phase: 'start', changes: [{ type: 'select', item: 'node', id: 'b', from: false, to: true }, move(310)] });
    flush();
    api().emit({ phase: 'update', changes: [move(320)] });
    flush();
    expect(live()).toBe('');
    api().emit({ phase: 'end', changes: [] });
    flush();
    expect(live()).toBe('Moved b to 320, 0');
  });

  test('the app’s messages replace the defaults; an empty one says nothing', () => {
    const { nodeElement, key, live } = editor(state, {
      flow: { messages: { selected: ({ nodes }) => `${nodes.length} picked`, moved: () => '' } },
    });
    nodeElement('a').focus();
    key(' ');
    expect(live()).toBe('1 picked');
    key('ArrowRight');
    expect(live()).toBe('1 picked');
  });

  test('a read-only Flow announces nothing it doesn’t send', () => {
    const { nodeElement, key, live } = editor(state, { flow: { interactive: false } });
    nodeElement('a').focus();
    key(' ');
    expect(live()).toBe('');
  });

  test('announcing re-runs only the live region', async () => {
    const { nodeElement, key } = editor();
    nodeElement('a').focus();
    key(' ');
    const { artifact } = await captureArtifact(() => key('ArrowRight'), { scenario: 'announce-move' });
    expect(artifact).toHaveNoDiagnostics();
    // The moved Node's position and attributes, and the live region's text.
    expect(artifact).toStayWithinRerunBudget(1, { scope: 'node:a:position' });
    expect(artifact).toStayWithinRerunBudget(0, { scope: /^node:[bc]/ });
  });
});
