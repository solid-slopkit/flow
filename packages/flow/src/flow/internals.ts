// State the Flow's own components share and the app doesn't see: Measured sizes (ADR 0015), drawing order, and what a
// drag in progress shows.
import { createContext, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';

import type { Connection, ConnectEnd } from '../connection/connect';
import type { ConnectionRule } from '../connection/rules';
import type { FlowNode, Point, PortKind, Side, Size } from '../model/model';

/** A Port as measured in the page: its centre relative to its Node's top-left corner, and its side. */
export type MeasuredPort = Point & { side: Side };

/** A line drawn while dragging, in Flow coordinates. */
export type Guide = { x1: number; y1: number; x2: number; y2: number };

/** What a `<Node>` says about itself that isn't in the data. */
export type NodeOptions = { keepInParent: boolean };

/** A Port as the Flow knows it: a rendered `<Port>`'s props over its declared `PortSpec`. Its fields are reactive. */
export type PortInfo = { side: Side | undefined; kind: PortKind; max: number | undefined };

/** What an `<Edge>` draws: its SVG content for the Edge layer, and its label for the label layer (ADR 0015). */
export type EdgeLayers = { path: JSX.Element; label: JSX.Element };

export type ReparentRule = (node: FlowNode<any>, parent: FlowNode<any> | undefined) => boolean;

export interface FlowInternals {
  measuredSize(id: string): Size | undefined;
  setMeasuredSize(id: string, size: Size | undefined): void;
  measuredPorts(id: string): Readonly<Record<string, MeasuredPort>> | undefined;
  setMeasuredPorts(id: string, ports: Record<string, MeasuredPort> | undefined): void;
  /** Drawing order: a Node is drawn above its Parent, and a later top-level Node above an earlier one with all its children. */
  zOrder(id: string): number;
  nodeOptions: Map<string, NodeOptions>;
  /** The rendered `<Port>`s, by Node id and then Port id. */
  portInfo: Map<string, Map<string, PortInfo>>;
  /** The rendered `<Edge>`s, in the order they were rendered. */
  edgeLayers(): readonly EdgeLayers[];
  addEdgeLayers(layers: EdgeLayers): void;
  removeEdgeLayers(layers: EdgeLayers): void;
  dragging(id: string): boolean;
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
}

export const FlowInternalsContext = createContext<FlowInternals>(undefined, { name: 'FlowInternals' });

export const useFlowInternals = () => useContext(FlowInternalsContext);
