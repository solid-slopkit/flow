// State the Flow's own components share and the app doesn't see: Measured sizes (ADR 0015), drawing order, and what a
// drag in progress shows.
import { createContext, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';

import type { FlowMessages } from '../accessibility/messages';
import type { Connection, ConnectEnd } from '../connection/connect';
import type { ConnectionRule } from '../connection/rules';
import type { ClipboardPayload } from '../clipboard/payload';
import type { SelectionMode } from '../selection/pointer';
import type { FlowNode, Point, PortKind, Rect, Side, Size } from '../model/model';

/** A Port as measured in the page: its centre relative to its Node's top-left corner, and its side. */
export type MeasuredPort = Point & { side: Side };

/** A line drawn while dragging, in Flow coordinates. */
export type Guide = { x1: number; y1: number; x2: number; y2: number };

/** What a `<Node>` says about itself that isn't in the data. */
export type NodeOptions = { keepInParent: boolean; label: string | undefined; shown: boolean };

/** A Port as the Flow knows it: a rendered `<Port>`'s props over its declared `PortSpec`. Its fields are reactive. */
export type PortInfo = { side: Side | undefined; kind: PortKind; max: number | undefined };

/** What an `<Edge>` draws: its SVG content for the Edge layer, and its label for the label layer (ADR 0015). */
export type EdgeLayers = { path: JSX.Element; label: JSX.Element };

/** Where built-in UI draws: under the Viewport (a Background), or over it in a corner (Controls, a MiniMap). */
export type FlowLayer = 'background' | 'panel';

/** A Node's box in Flow coordinates. */
export type NodeBox = { id: string; bounds: Rect };

/** What keyboard focus is on, or inside: a Node (or one of its Ports), or an Edge (or its label). */
export type FocusTarget = { node: string } | { edge: string };

export type ReparentRule = (node: FlowNode<any>, parent: FlowNode<any> | undefined) => boolean;

export interface FlowInternals {
  measuredSize(id: string): Size | undefined;
  setMeasuredSize(id: string, size: Size | undefined): void;
  measuredPorts(id: string): Readonly<Record<string, MeasuredPort>> | undefined;
  setMeasuredPorts(id: string, ports: Record<string, MeasuredPort> | undefined): void;
  /** Drawing order: a Node is drawn above its Parent, and a later top-level Node above an earlier one with all its children. */
  zOrder(id: string): number;
  nodeOptions: Map<string, NodeOptions>;
  /** A Node's text content, its name unless it has an `aria-label`; `undefined` forgets it. */
  setNodeText(id: string, text: string | undefined): void;
  /** A Node's name for labels and announcements: its `aria-label`, else its text, else its id. Reactive. */
  nodeName(id: string): string;
  /** The Flow's labels and announcements, the app's over the defaults. */
  messages(): FlowMessages;
  /** Says this in the Flow's live region. */
  announce(text: string): void;
  /** The rendered `<Port>`s, by Node id and then Port id. */
  portInfo: Map<string, Map<string, PortInfo>>;
  /** The rendered `<Edge>`s, in the order they were rendered. */
  edgeLayers(): readonly EdgeLayers[];
  addEdgeLayers(layers: EdgeLayers): void;
  removeEdgeLayers(layers: EdgeLayers): void;
  /** What built-in UI drew in one layer, in the order it was rendered. */
  layer(layer: FlowLayer): readonly JSX.Element[];
  addToLayer(layer: FlowLayer, element: JSX.Element): void;
  removeFromLayer(layer: FlowLayer, element: JSX.Element): void;
  /** Whether the Flow renders only the Nodes and Edges in sight (ADR 0015). */
  culling(): boolean;
  /** Whether a box in Flow coordinates is in the visible area; always while everything is rendered. Reactive. */
  inSight(box: Rect): boolean;
  /** Whether a `<Node>` renders its element: always, unless it is out of sight and nothing keeps it. Reactive per Node. */
  nodeShown(id: string): boolean;
  /** Whether focus or a Connection keeps a Node rendered out of sight. Reactive per Node. */
  nodeHeld(id: string): boolean;
  /** Whether focus is on or inside this Edge; changes only when focus moves to or from it. */
  edgeFocused(id: string): boolean;
  /** Where focus is in the Flow, so that Node or Edge stays rendered while it has it. */
  setFocused(target: FocusTarget | undefined): void;
  dragging(id: string): boolean;
  /** Every Node with a size, and its box in Flow coordinates, in state order. */
  nodeBoxes(): readonly NodeBox[];
  /** `nodeBoxes()`, except that it holds still while Nodes are dragged and changes once the drag ends. */
  settledNodeBoxes(): readonly NodeBox[];
  setDragging(ids: ReadonlySet<string>): void;
  dropTarget(): string | undefined;
  setDropTarget(id: string | undefined): void;
  guides(): readonly Guide[];
  setGuides(guides: readonly Guide[]): void;
  /** `[x, y]` grid spacing, when dragging snaps to a grid. */
  snapToGrid(): readonly [number, number] | undefined;
  /** How close, in screen pixels, a dragged Node's edge or centre snaps to another's; `undefined` when off. */
  guideThreshold(): number | undefined;
  /** Whether a dragged Node may be dropped into this Parent (`undefined`: top level); `undefined` when off. */
  reparentRule(): ReparentRule | undefined;
  connection(): Connection | undefined;
  /** Whether there is a Connection; changes only when one starts or ends. */
  connecting(): boolean;
  setConnection(connection: Connection | undefined): void;
  /** Whether the Connection starts at this Port; changes only when it starts or ends. */
  connectingFrom(node: string, port: string): boolean;
  /** Whether the Connection snaps to this Port; changes only when it snaps to another. */
  connectionTarget(node: string, port: string): boolean;
  /** Whether this Edge's end is being dragged. */
  reconnecting(edge: string): boolean;
  canConnect(): ConnectionRule | undefined;
  /** How close, in screen pixels, a Connection snaps to a valid Port. */
  connectionRadius(): number;
  /** A new Connection was dropped on empty space. */
  connectEnd(end: ConnectEnd): void;
  /** The selection box being drawn, in pixels from the Flow's top-left corner. */
  selectionBox(): Rect | undefined;
  setSelectionBox(box: Rect | undefined): void;
  selectionMode(): SelectionMode;
  /** The app's transform of a payload being copied; `undefined` copies nothing. */
  transformCopy(payload: ClipboardPayload): ClipboardPayload | undefined;
  /** The app's transform of a payload being pasted; `undefined` pastes nothing. */
  transformPaste(payload: ClipboardPayload): ClipboardPayload | undefined;
}

export const FlowInternalsContext = createContext<FlowInternals>(undefined, { name: 'FlowInternals' });

export const useFlowInternals = () => useContext(FlowInternalsContext);
