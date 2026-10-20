// Built-in UI draws outside the Viewport's transform: a Background under it, Controls and a MiniMap over it in a corner.
// Each hands its element to the Flow's layer while it renders, as an <Edge> does (ADR 0015), so it renders on the
// server too (ADR 0019).
import { onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';

import { useFlowInternals, type FlowLayer } from '../flow/internals';

/** The corner of the Flow a panel sits in. */
export type PanelPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** Draws `element` in one of the Flow's layers for as long as the calling component lives. */
export function drawInLayer(layer: FlowLayer, element: JSX.Element): void {
  const internals = useFlowInternals();
  internals.addToLayer(layer, element);
  onCleanup(() => internals.removeFromLayer(layer, element));
}

/** The class list of a panel's root: the library's own class, then the app's. */
export const panelClass = (own: string, extra: string | undefined) =>
  extra ? `slp-flow-panel ${own} ${extra}` : `slp-flow-panel ${own}`;
