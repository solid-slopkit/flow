# Positions relative to the Parent

A Node may name a Parent Node in its data (`parent`). Its `position` is then relative to the Parent's top-left corner: it moves with the Parent, can be kept inside it, and is drawn above it. Top-level Nodes are positioned in Flow coordinates. The library derives every Node's absolute position, and all geometry (Edge ends, routing, hit-testing, the selection box, `fitView`, the MiniMap, Layout) works on absolute positions from the first step.

Nesting is decided now, though grouping UI comes later, because retrofitting it means rewriting every geometry function written for absolute positions.

## Considered Options

- **Flat positions, groups only drawn behind their Nodes:** rejected. Moving a group would have to move each member by hand, and members could not be kept inside it.
- **Nesting expressed by nesting `<Node>` in JSX:** rejected. Re-parenting would move the Node's DOM and lose its focus and state (ADR 0013).
