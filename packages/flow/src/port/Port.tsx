import { createEffect, onCleanup, onSettled, untrack, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';

import { useFlow } from '../flow/Flow';
import { useFlowInternals, type PortInfo } from '../flow/internals';
import type { PortKind, Side } from '../model/model';
import { NodeMeasuringContext, useNode } from '../node/Node';

export interface PortProps {
  /** Unique within its Node (ADR 0018). It doesn't change for the life of the Port. */
  id: string;
  /** Which side of the Node it sits on. Defaults to the side declared in the Node's `ports`, else the nearest side. */
  side?: Side;
  /** Where along the side, as a fraction from its top or left corner. Defaults to the declared offset, else 0.5. */
  offset?: number;
  /** Which Edge ends it accepts. Defaults to the declared kind, else `both`. */
  kind?: PortKind;
  /** The most Edges it accepts. Defaults to the declared `max`, else unlimited. */
  max?: number;
  /** The Port's name for assistive technology. Defaults to `messages.portLabel`, from its id and its Node's name. */
  'aria-label'?: string;
  class?: string;
  style?: JSX.CSSProperties;
  children?: JSX.Element;
}

/**
 * A point on the Node it is placed in where Edges attach. It sits on its side at its offset; the Flow measures where it
 * ends up, and Edges use that point from then on (ADR 0019).
 */
export function Port(props: PortProps): JSX.Element {
  const flow = useFlow();
  const internals = useFlowInternals();
  const node = useNode();
  const measuring = useContext(NodeMeasuringContext);
  const nodeId = untrack(() => node.id(), false);
  const id = untrack(() => props.id, false);
  const declared = () =>
    flow
      .index()
      .node(nodeId)
      ?.ports?.find((spec) => spec.id === props.id);
  const side = () => props.side ?? declared()?.side;
  const offset = () => props.offset ?? declared()?.offset ?? 0.5;
  const kind = () => props.kind ?? declared()?.kind ?? 'both';
  const max = () => props.max ?? declared()?.max;
  let element: HTMLDivElement | undefined;

  const info: PortInfo = {
    get side() {
      return side() ?? flow.measuredPort(nodeId, id)?.side;
    },
    get kind() {
      return kind();
    },
    get max() {
      return max();
    },
  };
  let ports = internals.portInfo.get(nodeId);
  if (!ports) internals.portInfo.set(nodeId, (ports = new Map()));
  ports.set(id, info);
  onCleanup(() => {
    if (ports.get(id) !== info) return;
    // A Node out of sight keeps what its Ports said until they are rendered again, or the Node is gone (ADR 0015).
    if (!untrack(() => internals.nodeShown(nodeId), false)) {
      ports.set(
        id,
        untrack(() => ({ side: info.side, kind: info.kind, max: info.max }), false),
      );
      return;
    }
    ports.delete(id);
    if (!ports.size) internals.portInfo.delete(nodeId);
  });

  onSettled(() => measuring.observePort(element!));
  // Moving along or to another side doesn't resize anything, so it is measured here.
  createEffect(
    () => [side(), offset()],
    () => measuring.measure(),
  );

  return (
    <div
      ref={(port) => (element = port)}
      class={props.class ? `slp-flow-port ${props.class}` : 'slp-flow-port'}
      data-flow-port={props.id}
      tabindex="-1"
      role="button"
      aria-roledescription={internals.messages().port}
      aria-label={props['aria-label'] ?? internals.messages().portLabel({ port: id, node: internals.nodeName(nodeId) })}
      aria-disabled={flow.interactive() ? undefined : 'true'}
      data-flow-port-side={side()}
      data-flow-port-kind={kind()}
      data-connectable={flow.interactive() ? '' : undefined}
      data-connecting={internals.connectingFrom(nodeId, id) ? '' : undefined}
      data-connection-target={internals.connectionTarget(nodeId, id) ? '' : undefined}
      style={{ '--_flow-port-offset': offset(), ...props.style }}
    >
      {props.children}
    </div>
  );
}
