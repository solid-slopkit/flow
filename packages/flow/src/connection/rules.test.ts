import { describe, expect, test } from 'vitest';

import { indexFlow } from '../model/flow-index';
import type { FlowEdge, FlowNode, FlowState, PortSpec } from '../model/model';
import { canStartFrom, connectionEnds, edgesAtPort, startRole, type PortLookup } from './rules';

const node = (id: string, ports: PortSpec[]): FlowNode => ({
  id,
  position: { x: 0, y: 0 },
  ports,
  data: null,
});
const edge = (id: string, source: [string, string?], target: [string, string?]): FlowEdge => ({
  id,
  source: { node: source[0], port: source[1] },
  target: { node: target[0], port: target[1] },
  data: null,
});

const state: FlowState = {
  nodes: [
    node('a', [
      { id: 'out', side: 'right', kind: 'source' },
      { id: 'in', side: 'left', kind: 'target', max: 1 },
      { id: 'any', side: 'top' },
    ]),
    node('b', [
      { id: 'out', side: 'right', kind: 'source', max: 1 },
      { id: 'in', side: 'left', kind: 'target' },
      { id: 'any', side: 'top' },
    ]),
  ],
  edges: [edge('ba', ['b', 'out'], ['a', 'in'])],
};
const index = indexFlow(state);
const port: PortLookup = (id, portId) => {
  const spec = index.node(id)?.ports?.find((declared) => declared.id === portId);
  return spec && { kind: spec.kind ?? 'both', max: spec.max };
};

describe('edgesAtPort', () => {
  test('counts the Edges at a Port, without one, and a loop once', () => {
    const looped = indexFlow({
      ...state,
      edges: [...state.edges, edge('loop', ['b', 'any'], ['b', 'any'])],
    });
    expect(edgesAtPort(looped, { node: 'a', port: 'in' })).toBe(1);
    expect(edgesAtPort(looped, { node: 'a', port: 'in' }, 'ba')).toBe(0);
    expect(edgesAtPort(looped, { node: 'b', port: 'any' })).toBe(1);
    expect(edgesAtPort(looped, { node: 'b', port: 'in' })).toBe(0);
  });
});

describe('canStartFrom', () => {
  test('a Port with room for another Edge', () => {
    expect(canStartFrom(index, port, { node: 'a', port: 'out' })).toBe(true);
    expect(canStartFrom(index, port, { node: 'b', port: 'out' })).toBe(false);
    expect(canStartFrom(index, port, { node: 'a', port: 'in' })).toBe(false);
    expect(canStartFrom(index, port, { node: 'nope', port: 'out' })).toBe(false);
    expect(canStartFrom(index, port, { node: 'a' })).toBe(false);
  });
});

describe('startRole', () => {
  test('a source or target Port keeps its kind; a both Port is the Source unless it ends on a source Port', () => {
    expect(startRole('source', 'both')).toBe('source');
    expect(startRole('target')).toBe('target');
    expect(startRole('both', 'target')).toBe('source');
    expect(startRole('both', 'both')).toBe('source');
    expect(startRole('both', 'source')).toBe('target');
  });
});

describe('connectionEnds', () => {
  test('a source Port connects to a target or both Port, as the Source', () => {
    expect(connectionEnds(index, port, { node: 'a', port: 'out' }, { node: 'b', port: 'in' })).toEqual({
      source: { node: 'a', port: 'out' },
      target: { node: 'b', port: 'in' },
    });
    expect(connectionEnds(index, port, { node: 'a', port: 'out' }, { node: 'b', port: 'any' })).toBeDefined();
    expect(connectionEnds(index, port, { node: 'a', port: 'out' }, { node: 'b', port: 'out' })).toBeUndefined();
  });

  test('a target Port is the Target; a both Port takes the role the other Port leaves', () => {
    expect(connectionEnds(index, port, { node: 'b', port: 'in' }, { node: 'a', port: 'out' })).toEqual({
      source: { node: 'a', port: 'out' },
      target: { node: 'b', port: 'in' },
    });
    expect(connectionEnds(index, port, { node: 'b', port: 'any' }, { node: 'a', port: 'out' })).toEqual({
      source: { node: 'a', port: 'out' },
      target: { node: 'b', port: 'any' },
    });
    expect(connectionEnds(index, port, { node: 'b', port: 'any' }, { node: 'a', port: 'any' })).toEqual({
      source: { node: 'b', port: 'any' },
      target: { node: 'a', port: 'any' },
    });
  });

  test('never the same Port, a missing Node, or a Floating end; other Ports of the same Node are allowed', () => {
    expect(connectionEnds(index, port, { node: 'a', port: 'any' }, { node: 'a', port: 'any' })).toBeUndefined();
    expect(connectionEnds(index, port, { node: 'a', port: 'out' }, { node: 'nope', port: 'in' })).toBeUndefined();
    expect(connectionEnds(index, port, { node: 'a', port: 'out' }, { node: 'b' })).toBeUndefined();
    expect(connectionEnds(index, port, { node: 'a', port: 'out' }, { node: 'a', port: 'any' })).toBeDefined();
  });

  test('a Port at its max is full, except for the Edge being reconnected', () => {
    expect(connectionEnds(index, port, { node: 'b', port: 'any' }, { node: 'a', port: 'in' })).toBeUndefined();
    expect(
      connectionEnds(index, port, { node: 'b', port: 'any' }, { node: 'a', port: 'in' }, { fromRole: 'source', edge: 'ba' }),
    ).toEqual({
      source: { node: 'b', port: 'any' },
      target: { node: 'a', port: 'in' },
    });
  });

  test('reconnecting keeps the role of the end that stays, whatever its kind', () => {
    // The Source end (b.out) of `ba` is dragged; its Target, a.in, stays the Target.
    expect(
      connectionEnds(index, port, { node: 'a', port: 'in' }, { node: 'b', port: 'any' }, { fromRole: 'target', edge: 'ba' }),
    ).toEqual({
      source: { node: 'b', port: 'any' },
      target: { node: 'a', port: 'in' },
    });
    expect(
      connectionEnds(index, port, { node: 'a', port: 'in' }, { node: 'b', port: 'in' }, { fromRole: 'target' }),
    ).toBeUndefined();
    // A Floating end that stays.
    expect(connectionEnds(index, port, { node: 'a' }, { node: 'b', port: 'in' }, { fromRole: 'source' })).toEqual({
      source: { node: 'a' },
      target: { node: 'b', port: 'in' },
    });
  });

  test('canConnect decides last, with the Source and Target', () => {
    const asked: unknown[] = [];
    const canConnect = (source: { node: string }, target: { node: string }) => {
      asked.push([source, target]);
      return source.node !== target.node;
    };
    expect(connectionEnds(index, port, { node: 'b', port: 'in' }, { node: 'a', port: 'out' }, { canConnect })).toBeDefined();
    expect(asked).toEqual([
      [
        { node: 'a', port: 'out' },
        { node: 'b', port: 'in' },
      ],
    ]);
    expect(connectionEnds(index, port, { node: 'a', port: 'out' }, { node: 'a', port: 'any' }, { canConnect })).toBeUndefined();
    // Not asked when the kinds already refuse it.
    connectionEnds(index, port, { node: 'a', port: 'out' }, { node: 'b', port: 'out' }, { canConnect });
    expect(asked).toHaveLength(2);
  });
});
