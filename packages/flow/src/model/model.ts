// The records the app keeps in its own store (ADR 0014). The Flow reads them and never writes them.

/** A point in Flow coordinates (ADR 0017: relative to the Parent for a nested Node's `position`). */
export type Point = { x: number; y: number };

export type Size = { width: number; height: number };

/** A box in Flow coordinates: its top-left corner and size. */
export type Rect = { x: number; y: number; width: number; height: number };

/** Which side of its Node a Port sits on, and so which way an Edge leaves it. */
export type Side = 'top' | 'right' | 'bottom' | 'left';

/** Which Edge ends a Port accepts (ADR 0018). */
export type PortKind = 'source' | 'target' | 'both';

/** A Port declared in data, so Edges can be drawn before the Node is measured (ADR 0019). */
export type PortSpec = {
  /** Unique within its Node only (ADR 0018). */
  id: string;
  side: Side;
  /** Where along the side, as a fraction of its length from the top or left corner. Defaults to 0.5. */
  offset?: number;
  /** Defaults to `both`. */
  kind?: PortKind;
  /** The most Edges the Port accepts. Unlimited when unset. */
  max?: number;
};

/** An Edge's Source or Target: a Node and, optionally, one of its Ports. Without a Port it is a Floating end. */
export type End = { node: string; port?: string };

/** How an Edge's line runs between its ends. */
export type EdgeShapeName = 'bezier' | 'straight' | 'step' | 'smooth-step' | 'routed-step';

export type FlowNode<D = unknown> = {
  id: string;
  /** Relative to the Parent's top-left corner when `parent` is set, else in Flow coordinates (ADR 0017). */
  position: Point;
  /** The id of the Node this one is nested in. */
  parent?: string;
  /** The Declared size, used until (or instead of) the Measured size. */
  size?: Size;
  selected?: boolean;
  /** Defaults to `true`. */
  draggable?: boolean;
  ports?: PortSpec[];
  data: D;
};

export type FlowEdge<D = unknown> = {
  id: string;
  source: End;
  target: End;
  /** Defaults to `bezier`. */
  shape?: EdgeShapeName;
  /**
   * Corners in Flow coordinates, from end to end, such as a Layout's. A routed step Edge starts from it while it still
   * joins the ends and crosses no Node.
   */
  route?: Point[];
  selected?: boolean;
  data: D;
};

/** The whole Flow's data, kept by the app as one object so a Batch touching Nodes and Edges is one write. */
export type FlowState<N = unknown, E = unknown> = {
  nodes: FlowNode<N>[];
  edges: FlowEdge<E>[];
};
