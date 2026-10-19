import { flush } from 'solid-js';
import { describe, expect, test } from 'vitest';

import { renderEditor } from '../../test/editor';
import { render } from '../../test/render';
import { Flow } from '../flow/Flow';
import type { FlowState } from '../model/model';
import { Port } from './Port';

const state: FlowState = {
  nodes: [
    {
      id: 'a',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 50 },
      ports: [{ id: 'out', side: 'right', offset: 0.25, kind: 'source', max: 2 }],
      data: null,
    },
  ],
  edges: [],
};

function editor(content: () => ReturnType<typeof Port>) {
  const result = renderEditor(state, { content });
  flush();
  const port = (id: string) => result.nodeElement('a').querySelector<HTMLElement>(`[data-flow-port="${id}"]`)!;
  return { ...result, port };
}

describe('<Port>', () => {
  test('renders a Port element in its Node, with its side, kind and offset', () => {
    const { port } = editor(() => <Port id="in" side="top" offset={0.75} kind="target" class="dot" style={{ color: 'red' }} />);
    expect(port('in')).toHaveClass('slp-flow-port', 'dot');
    expect(port('in')).toHaveAttribute('data-flow-port-side', 'top');
    expect(port('in')).toHaveAttribute('data-flow-port-kind', 'target');
    expect(port('in').style.getPropertyValue('--_flow-port-offset')).toBe('0.75');
    expect(port('in').style.color).toBe('red');
  });

  test('defaults to the Port its Node declares, else to both kinds and the middle', () => {
    const { port, api } = editor(() => (
      <>
        <Port id="out" />
        <Port id="free" />
      </>
    ));
    expect(port('out')).toHaveAttribute('data-flow-port-side', 'right');
    expect(port('out')).toHaveAttribute('data-flow-port-kind', 'source');
    expect(port('out').style.getPropertyValue('--_flow-port-offset')).toBe('0.25');
    expect(api().port('a', 'out')).toEqual({ side: 'right', kind: 'source', max: 2 });
    expect(port('free')).not.toHaveAttribute('data-flow-port-side');
    expect(port('free')).toHaveAttribute('data-flow-port-kind', 'both');
    expect(port('free').style.getPropertyValue('--_flow-port-offset')).toBe('0.5');
    expect(api().port('a', 'free')).toEqual({ side: undefined, kind: 'both', max: undefined });
  });

  test('props win over the declaration', () => {
    const { api } = editor(() => <Port id="out" side="bottom" kind="both" max={1} />);
    expect(api().port('a', 'out')).toEqual({ side: 'bottom', kind: 'both', max: 1 });
  });

  test('useFlow().port falls back to declared Ports', () => {
    const { api } = editor(() => null);
    expect(api().port('a', 'out')).toEqual({ side: 'right', kind: 'source', max: 2 });
    expect(api().port('a', 'nope')).toBeUndefined();
    expect(api().port('nope', 'out')).toBeUndefined();
  });

  test('outside a Node throws', () => {
    expect(() =>
      render(() => (
        <Flow state={state}>
          <Port id="in" />
        </Flow>
      )),
    ).toThrow();
  });
});
