// Where a Connection may end (ADR 0018): Port kinds first, then `max`, then the app's `canConnect`. Pure: no DOM.
import type { FlowIndex } from '../model/flow-index';
import type { End, PortKind } from '../model/model';

/** The app's rule for whether an Edge may run from `source` to `target` (ADR 0018). */
export type ConnectionRule = (source: End, target: End) => boolean;

/** A Port's kind and `max`, as `useFlow().port()` reports them; `undefined` reads as `both` and unlimited. */
export type PortLookup = (node: string, port: string) => { kind: PortKind; max: number | undefined } | undefined;

const sameEnd = (a: End, b: End) => a.node === b.node && a.port === b.port;

/** How many Edges have an end at this Port, without the Edge `except`. A loop on the Port counts once. */
export function edgesAtPort(index: FlowIndex, end: End, except?: string): number {
  let count = 0;
  for (const edge of index.edgesOf(end.node)) {
    if (edge.id !== except && (sameEnd(edge.source, end) || sameEnd(edge.target, end))) count++;
  }
  return count;
}

/** Whether a Connection may start from this Port: it exists and has room for another Edge. */
export function canStartFrom(index: FlowIndex, port: PortLookup, from: End): boolean {
  if (from.port === undefined || !index.node(from.node)) return false;
  const max = port(from.node, from.port)?.max;
  return max === undefined || edgesAtPort(index, from) < max;
}

/**
 * Which end a Connection's starting Port becomes when it ends on a Port of `toKind`: a `source` Port is the Source, a
 * `target` Port the Target, and a `both` Port the Target only when ending on a `source` Port.
 */
export function startRole(fromKind: PortKind, toKind: PortKind = 'both'): 'source' | 'target' {
  if (fromKind === 'both') return toKind === 'source' ? 'target' : 'source';
  return fromKind;
}

export interface ConnectionEndsOptions {
  /** Reconnecting: the role the end that stays keeps. A new Connection takes it from the starting Port's kind. */
  fromRole?: 'source' | 'target';
  /** Reconnecting: the Edge being moved, which doesn't count against `max`. */
  edge?: string;
  canConnect?: ConnectionRule;
}

/**
 * The Source and Target of the Edge a Connection from `from` would make by ending on the Port `to`, or `undefined`
 * when it may not end there: not a Port, the same Port, a kind that doesn't accept that end, a Port at its `max`, or
 * one `canConnect` refuses.
 */
export function connectionEnds(
  index: FlowIndex,
  port: PortLookup,
  from: End,
  to: End,
  options: ConnectionEndsOptions = {},
): { source: End; target: End } | undefined {
  if (to.port === undefined || !index.node(to.node) || sameEnd(from, to)) return undefined;
  const target = port(to.node, to.port);
  const toKind = target?.kind ?? 'both';
  const fromKind = from.port === undefined ? 'both' : (port(from.node, from.port)?.kind ?? 'both');
  const fromRole = options.fromRole ?? startRole(fromKind, toKind);
  const toRole = fromRole === 'source' ? 'target' : 'source';
  if (toKind !== 'both' && toKind !== toRole) return undefined;
  if (target?.max !== undefined && edgesAtPort(index, to, options.edge) >= target.max) return undefined;
  const ends = fromRole === 'source' ? { source: from, target: to } : { source: to, target: from };
  if (options.canConnect && !options.canConnect(ends.source, ends.target)) return undefined;
  return ends;
}
