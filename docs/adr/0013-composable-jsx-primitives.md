# Composable JSX primitives, not a data-driven component

`@solid-slopkit/flow` is a set of primitives the app composes in JSX: `<Flow>` with `<Node>`, `<Port>` and `<Edge>` children, which the app renders itself, usually with `<For each={state.nodes}>`. The library owns geometry, the Viewport, dragging, Connections and Selection; a Node's content is the app's own JSX. Solid components run once and update at the level of single signals, so rendering a list of Nodes in the app's JSX costs nothing over the library rendering it, and the app gets full types and no lookup of node kinds by string.

The JSX tree stays flat: a nested Node is written next to its Parent and names it in data (ADR 0017), so re-parenting a Node never moves its DOM or loses its focus and state.

## Considered Options

- **A data-driven component** (`<Flow nodes edges nodeTypes>`, the library renders every Node from a lookup of components): rejected. It exists to avoid re-rendering a whole tree, which Solid doesn't do, and it hides the app's JSX behind a string-keyed registry.
- **Both, a data-driven wrapper over the primitives:** not ruled out. It can be added on top later; the primitives come first.
