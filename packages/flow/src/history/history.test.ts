import { captureArtifact } from '../../test/capture';
import { createMemo, createRoot, createStore, flush, snapshot } from 'solid-js';
import { describe, expect, test } from 'vitest';

import { applyChanges } from '../changes/apply';
import type { Batch, Change } from '../changes/changes';
import type { FlowState } from '../model/model';
import { createHistory } from './history';

const move = (node: string, from: number, to: number): Change => ({
  type: 'move',
  node,
  from: { x: from, y: 0 },
  to: { x: to, y: 0 },
});
const select = (id: string, to: boolean): Change => ({ type: 'select', item: 'node', id, from: !to, to });

describe('createHistory', () => {
  test('starts empty', () => {
    const history = createHistory();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(history.undo()).toBeUndefined();
    expect(history.redo()).toBeUndefined();
  });

  test('records a one-shot Batch as one entry, undone by its Inverse', () => {
    const history = createHistory();
    history.record({ changes: [move('a', 0, 10), move('b', 0, 5)] });
    expect(history.canUndo()).toBe(true);
    expect(history.undo()).toEqual({ changes: [move('b', 5, 0), move('a', 10, 0)] });
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);
    expect(history.redo()).toEqual({ changes: [move('a', 0, 10), move('b', 0, 5)] });
    expect(history.canRedo()).toBe(false);
  });

  test('records a gesture at end, as one entry from its first from to its last to', () => {
    const history = createHistory();
    history.record({ phase: 'start', changes: [move('a', 0, 1), move('b', 0, 1)] });
    history.record({ phase: 'update', changes: [move('a', 1, 5), move('b', 1, 5)] });
    expect(history.canUndo()).toBe(false);
    history.record({ phase: 'update', changes: [move('a', 5, 9), move('b', 5, 9)] });
    history.record({ phase: 'end', changes: [] });
    expect(history.undo()).toEqual({ changes: [move('b', 9, 0), move('a', 9, 0)] });
    expect(history.canUndo()).toBe(false);
  });

  test('keeps Changes apart when another Change on the same record comes between', () => {
    const history = createHistory();
    const reparent: Change = {
      type: 'reparent',
      node: 'a',
      from: { position: { x: 9, y: 0 } },
      to: { parent: 'g', position: { x: 1, y: 0 } },
    };
    history.record({ phase: 'start', changes: [move('a', 0, 9)] });
    history.record({ phase: 'update', changes: [reparent] });
    history.record({ phase: 'end', changes: [move('a', 1, 2), move('a', 2, 3)] });
    expect(history.redo()).toBeUndefined();
    history.undo();
    expect(history.redo()).toEqual({ changes: [move('a', 0, 9), reparent, move('a', 1, 3)] });
  });

  test('does not record a gesture that ends where it started', () => {
    const history = createHistory();
    history.record({ phase: 'start', changes: [move('a', 0, 4)] });
    history.record({ phase: 'end', changes: [move('a', 4, 0)] });
    expect(history.canUndo()).toBe(false);
  });

  test('skips Selection unless asked', () => {
    const history = createHistory();
    history.record({ changes: [select('a', true)] });
    expect(history.canUndo()).toBe(false);
    history.record({ changes: [select('a', false), move('a', 0, 1)] });
    expect(history.undo()).toEqual({ changes: [move('a', 1, 0)] });

    const withSelection = createHistory({ selection: true });
    withSelection.record({ changes: [select('a', true)] });
    expect(withSelection.undo()).toEqual({ changes: [select('a', false)] });
  });

  test('a new entry clears redo', () => {
    const history = createHistory();
    history.record({ changes: [move('a', 0, 1)] });
    history.undo();
    history.record({ changes: [move('b', 0, 1)] });
    expect(history.canRedo()).toBe(false);
  });

  test('undo and redo through applyChanges', () => {
    const [flow, setFlow] = createStore<FlowState>({ nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: null }], edges: [] });
    const history = createHistory();
    const gesture: Batch[] = [
      { phase: 'start', changes: [move('a', 0, 3)] },
      { phase: 'update', changes: [move('a', 3, 7)] },
      { phase: 'end', changes: [] },
    ];
    for (const batch of gesture) {
      applyChanges(setFlow, batch);
      history.record(batch);
    }
    applyChanges(setFlow, history.undo()!);
    expect(snapshot(flow).nodes[0]!.position).toEqual({ x: 0, y: 0 });
    applyChanges(setFlow, history.redo()!);
    expect(snapshot(flow).nodes[0]!.position).toEqual({ x: 7, y: 0 });
  });

  test('canUndo re-runs its readers only when it flips', async () => {
    const { artifact } = await captureArtifact(
      () => {
        const history = createHistory();
        createRoot(() => {
          return createMemo(() => history.canUndo(), { name: 'undoButton' });
        });
        flush();
        history.record({ changes: [move('a', 0, 1)] });
        flush();
        history.record({ changes: [move('a', 1, 2)] });
        flush();
        history.undo();
        flush();
      },
      { scenario: 'history' },
    );
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toHaveNoWaste();
    expect(artifact).toStayWithinRerunBudget(1, { scope: 'undoButton' });
  });
});
