// ELK in a Web Worker (ADR 0020): the same layout as on the page, with only ELK's API loaded here.
import workerUrl from 'elkjs/lib/elk-worker.min.js?url';
import { describe, expect, test } from 'vitest';

import type { FlowState } from '../model/model';
import { elkInWorker, layout } from './index';

const state: FlowState = {
  nodes: ['a', 'b', 'c'].map((id) => ({
    id,
    position: { x: 0, y: 0 },
    size: { width: 100, height: 50 },
    ports: [
      { id: 'in', side: 'left' as const },
      { id: 'out', side: 'right' as const },
    ],
    data: null,
  })),
  edges: [
    { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' }, shape: 'routed-step', data: null },
    { id: 'ac', source: { node: 'a', port: 'out' }, target: { node: 'c', port: 'in' }, shape: 'routed-step', data: null },
  ],
};

describe('elkInWorker', () => {
  test('lays out in a Web Worker, as on the page', async () => {
    const elk = elkInWorker(workerUrl);
    try {
      const inWorker = await layout(state, { elk });
      expect(inWorker.changes.length).toBeGreaterThan(0);
      expect(inWorker).toEqual(await layout(state));
    } finally {
      elk.terminateWorker();
    }
  });
});
