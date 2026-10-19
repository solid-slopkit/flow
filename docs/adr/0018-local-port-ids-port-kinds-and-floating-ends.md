# Port ids local to their Node, Port kinds, Floating ends

An Edge's Source and Target are each `{ node: string; port?: string }`. A Port id is unique only within its Node, so Node templates reuse names like `"in"` and `"out"`. An end without a Port is a Floating end and attaches to the Node's outline, clipped to its border; it is part of the Edge's shape from the start, because adding it later changes the Edge record.

A Port has a side (`top | right | bottom | left`), which tells Edge shapes and the router which way to leave, and a Port kind (`source | target | both`, default `both`). A Port accepts any number of Edges unless it sets `max`. Whether a Connection may end on a Port is decided by the app's `canConnect(source, target)`; Port kinds are only the built-in first filter. Typed ports ("a number output only connects to number inputs") are expressed there, not in the library.

## Considered Options

- **Globally unique Port ids:** rejected. Every Node instance would need generated Port ids, and Edges would lose the readable `{ node, port: "out" }` form.
- **Directed Ports only:** rejected. Diagrams often have undirected Ports, which `both` covers.
- **A library-level type system for Ports:** rejected in favour of `canConnect`, which can express any rule the app has.
