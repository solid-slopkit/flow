// Routed step Edges with real layout and real input: the cost of rerouting on each drag frame (ADR 0021).
import { flush } from 'solid-js';
import { describe, expect, test } from 'vitest';

import { renderEditor } from '../../test/editor';
import { mouse, pointOf, settle } from '../../test/input';
import type { FlowEdge, FlowNode, FlowState } from '../model/model';

const COLUMNS = 12;
const ROWS = 12;
/** The most one drag frame may take, from the pointer event to the Edges redrawn, in milliseconds. */
const FRAME_BUDGET = 8;

/** A grid of Nodes, each joined to its right and lower neighbours by a routed step Edge. */
function grid(): FlowState {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const id = (column: number, row: number) => `${column}-${row}`;
  for (let row = 0; row < ROWS; row++)
    for (let column = 0; column < COLUMNS; column++) {
      nodes.push({
        id: id(column, row),
        position: { x: column * 200, y: row * 120 },
        size: { width: 100, height: 50 },
        ports: [
          { id: 'in', side: 'left' },
          { id: 'out', side: 'right' },
          { id: 'up', side: 'top' },
          { id: 'down', side: 'bottom' },
        ],
        data: null,
      });
      const edge = (to: string, from: string, into: string) =>
        edges.push({
          id: `${id(column, row)}>${to}`,
          source: { node: id(column, row), port: from },
          target: { node: to, port: into },
          shape: 'routed-step',
          data: null,
        });
      if (column + 1 < COLUMNS) edge(id(column + 1, row), 'out', 'in');
      if (row + 1 < ROWS) edge(id(column, row + 1), 'down', 'up');
    }
  return { nodes, edges };
}

describe('routed step Edges', () => {
  test(`a drag frame reroutes the moved Node’s Edges within ${FRAME_BUDGET} ms`, async () => {
    const state = grid();
    const { nodeElement, edgeElement } = renderEditor(state, {
      flow: { style: { width: '1200px', height: '800px' }, minZoom: 0.1 },
      content: () => <div style={{ width: '100px', height: '50px' }} />,
    });
    await settle();
    const moved = nodeElement('1-1');
    const path = (id: string) => edgeElement(id)!.querySelector('.slp-flow-edge-path')!.getAttribute('d');

    // Time each pointer move from its first listener to the Edges drawn: the Flow's own work for one frame.
    const frames: number[] = [];
    let started = 0;
    const start = () => (started = performance.now());
    const end = () => {
      flush();
      frames.push(performance.now() - started);
    };
    window.addEventListener('pointermove', start, { capture: true });
    window.addEventListener('pointermove', end);
    try {
      const from = pointOf(moved);
      await mouse('mousePressed', from);
      const before = path('1-1>2-1');
      // Across the grid, through rows of other Nodes, so the moved Node's Edges reroute round them.
      for (let step = 1; step <= 40; step++) await mouse('mouseMoved', { x: from.x + step * 9, y: from.y + step * 6 });
      expect(path('1-1>2-1')).not.toBe(before);
      await mouse('mouseReleased', { x: from.x + 360, y: from.y + 240 });
      await settle();
    } finally {
      window.removeEventListener('pointermove', start, { capture: true });
      window.removeEventListener('pointermove', end);
    }

    const dragFrames = [...frames].sort((a, b) => a - b);
    const median = dragFrames[Math.floor(dragFrames.length / 2)]!;
    console.info(
      `routed drag frames over ${state.edges.length} Edges: median ${median.toFixed(2)} ms, max ${dragFrames.at(-1)!.toFixed(2)} ms`,
    );
    expect(median).toBeLessThan(FRAME_BUDGET);
    // Never a whole frame at 60 Hz.
    expect(dragFrames.at(-1)!).toBeLessThan(16);
  });
});
