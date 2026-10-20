// Every string the Flow writes for assistive technology: its labels and what the live region announces. The app
// replaces any of them through the Flow's `messages` prop, to word or translate them.
import type { Point } from '../model/model';

export interface FlowMessages {
  /** The Flow's accessible name, unless it has an `aria-label`. */
  flow: string;
  /** How the Flow's keyboard works, read as the Flow's description when it gets focus. */
  instructions: string;
  /** What a Node, an Edge and a Port are called (their `aria-roledescription`). */
  node: string;
  edge: string;
  port: string;
  /** An Edge's accessible name, unless it has an `aria-label`, from its Nodes' names. */
  edgeLabel(edge: { source: string; target: string }): string;
  /** A Port's accessible name, unless it has an `aria-label`, from its id and its Node's name. */
  portLabel(port: { port: string; node: string }): string;
  /** Nodes were moved; `position` is where the first one went. */
  moved(move: { nodes: string[]; position: Point }): string;
  /** A Connection added an Edge between these Nodes. */
  connected(edge: { source: string; target: string }): string;
  /** An Edge's end was moved: the Nodes it now runs between. */
  reconnected(edge: { source: string; target: string }): string;
  /** Records were removed: the Nodes' names, and how many Edges went with them. */
  removed(removal: { nodes: string[]; edges: number }): string;
  /** Records were added, as by a paste. */
  added(addition: { nodes: number; edges: number }): string;
  /** The Selection now: the selected Nodes' names and how many Edges. Both empty when it was cleared. */
  selected(selection: { nodes: string[]; edges: number }): string;
  /** A Connection was started from the keyboard, with this many Ports it may end on. */
  connecting(connection: { port: string; node: string; targets: number }): string;
  /** A Connection was cancelled from the keyboard. */
  connectionCancelled: string;
  /** The names of `<Controls>` and its buttons. The lock button is a toggle, pressed while editing is locked. */
  controls: string;
  zoomIn: string;
  zoomOut: string;
  fitView: string;
  lock: string;
  /** The name of a `<MiniMap>`, and how its keyboard works, read as its description. */
  miniMap: string;
  miniMapInstructions: string;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Names as a phrase: `a`, `a and b`, `a, b and c`; more than three are counted. */
export function listNames(names: string[], noun: [string, string] = ['node', 'nodes']): string {
  if (names.length > 3) return plural(names.length, ...noun);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

const round = (value: number) => Math.round(value);

export const defaultMessages: FlowMessages = {
  flow: 'Flow',
  instructions:
    'Tab and Shift+Tab move between nodes, ports and edges. Space selects. Arrow keys move the selection, ' +
    'Delete removes it. Enter on a port starts a connection: Tab to a port it may end on and press Enter, or Escape to cancel.',
  node: 'node',
  edge: 'edge',
  port: 'port',
  edgeLabel: ({ source, target }) => `From ${source} to ${target}`,
  portLabel: ({ port, node }) => `${port} on ${node}`,
  moved: ({ nodes, position }) =>
    nodes.length === 1 ? `Moved ${nodes[0]} to ${round(position.x)}, ${round(position.y)}` : `Moved ${listNames(nodes)}`,
  connected: ({ source, target }) => `Connected ${source} to ${target}`,
  reconnected: ({ source, target }) => `Edge now runs from ${source} to ${target}`,
  removed: ({ nodes, edges }) => {
    const parts = [nodes.length ? listNames(nodes) : '', edges ? plural(edges, 'edge', 'edges') : ''].filter(Boolean);
    return `Removed ${parts.join(' and ')}`;
  },
  added: ({ nodes, edges }) => {
    const parts = [nodes ? plural(nodes, 'node', 'nodes') : '', edges ? plural(edges, 'edge', 'edges') : ''].filter(Boolean);
    return `Added ${parts.join(' and ')}`;
  },
  selected: ({ nodes, edges }) => {
    if (!nodes.length && !edges) return 'Selection cleared';
    const parts = [nodes.length ? listNames(nodes) : '', edges ? plural(edges, 'edge', 'edges') : ''].filter(Boolean);
    return `Selected ${parts.join(' and ')}`;
  },
  connecting: ({ port, node, targets }) =>
    targets
      ? `Connecting from ${port} on ${node}. ${plural(targets, 'port', 'ports')} to connect to: Tab to one and press Enter, or Escape to cancel.`
      : `Connecting from ${port} on ${node}. No port to connect to: press Escape to cancel.`,
  connectionCancelled: 'Connection cancelled',
  controls: 'Flow controls',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fitView: 'Fit view',
  lock: 'Lock editing',
  miniMap: 'Mini map',
  miniMapInstructions: 'Arrow keys pan the view. Plus and minus zoom in and out.',
};
