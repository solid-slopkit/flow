// Copy, cut and paste through the clipboard events (ADR 0022). They reach the Flow while it, or something in it, has
// focus; inside a text field they are the field's own.
import { keepFocus } from '../accessibility/focus';
import { removal } from '../changes/apply';
import type { FlowApi } from '../flow/Flow';
import type { FlowInternals } from '../flow/internals';
import type { Point } from '../model/model';
import { PANEL } from '../flow/gestures';
import { EDITABLE } from '../selection/keyboard';
import { selectionChanges } from '../selection/select';
import { CLIPBOARD_TYPE, copyPayload, parsePayload, pastePayload } from './payload';

export function attachClipboard(root: HTMLElement, flow: FlowApi, internals: FlowInternals): () => void {
  /** The pointer's last screen point over the Flow, where a paste lands. */
  let pointer: Point | undefined;
  const onPointerMove = (event: PointerEvent) => (pointer = { x: event.clientX, y: event.clientY });
  const onPointerLeave = () => (pointer = undefined);

  const ours = (event: ClipboardEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    return !!event.clipboardData && !target?.closest(`${EDITABLE}, ${PANEL}`);
  };

  /** Writes the copied Nodes; `true` when there was something to copy. */
  const write = (event: ClipboardEvent): boolean => {
    const copied = copyPayload(flow.state(), flow.index());
    const payload = copied && internals.transformCopy(copied);
    if (!payload) return false;
    const json = JSON.stringify(payload);
    event.clipboardData!.setData(CLIPBOARD_TYPE, json);
    event.clipboardData!.setData('text/plain', json);
    event.preventDefault();
    return true;
  };

  const onCopy = (event: ClipboardEvent) => {
    if (ours(event)) write(event);
  };

  const onCut = (event: ClipboardEvent) => {
    if (!ours(event) || !flow.interactive() || !write(event)) return;
    const state = flow.state();
    const nodes = state.nodes.filter((node) => node.selected).map((node) => node.id);
    const edges = state.edges.filter((edge) => edge.selected).map((edge) => edge.id);
    const change = removal(state, { nodes, edges });
    keepFocus(root, change);
    flow.emit({ changes: [change] });
  };

  const onPaste = (event: ClipboardEvent) => {
    if (!ours(event) || !flow.interactive()) return;
    const data = event.clipboardData!;
    const read = parsePayload(data.getData(CLIPBOARD_TYPE)) ?? parsePayload(data.getData('text/plain'));
    if (!read) return;
    event.preventDefault();
    const placed = pastePayload(read, () => flow.createId(), pointer && flow.screenToFlow(pointer));
    const payload = internals.transformPaste(placed);
    if (!payload || (!payload.nodes.length && !payload.edges.length)) return;
    const state = flow.state();
    flow.emit({
      changes: [
        ...selectionChanges(state, { nodes: new Set(), edges: new Set() }),
        { type: 'add', nodes: payload.nodes, edges: payload.edges },
      ],
    });
  };

  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerleave', onPointerLeave);
  root.addEventListener('copy', onCopy);
  root.addEventListener('cut', onCut);
  root.addEventListener('paste', onPaste);
  return () => {
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerleave', onPointerLeave);
    root.removeEventListener('copy', onCopy);
    root.removeEventListener('cut', onCut);
    root.removeEventListener('paste', onPaste);
  };
}
