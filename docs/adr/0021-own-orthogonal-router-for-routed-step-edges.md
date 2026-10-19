# Our own orthogonal router for routed step Edges

An Edge shape is a function `(source, target, context?) => { d, label }`. Source and target are the ends' points and sides in Flow coordinates; `context` gives access to the Flow's Node geometry and is reserved in the signature from the start, so routing could be added without breaking custom shapes.

The routed step shape avoids Nodes while the user edits. It is routed by a router written in this package: an A* search over a sparse grid built from the Nodes' bounding boxes plus a margin, with a penalty per bend. It runs synchronously, and on each drag frame only for the Edges attached to moved Nodes, so it keeps up with the pointer. After a Layout, ELK's routes (ADR 0020) are the starting routes until a Node moves. The other shapes (bezier, straight, step, smooth step) are not routed.

## Considered Options

- **Routes only from Layout:** rejected. Routes go stale as soon as a Node is dragged, and re-running an asynchronous Layout per frame lags behind the pointer.
- **An existing router compiled to WebAssembly:** rejected. A heavy binary and another optional peer, for a problem that stays small when limited to orthogonal routes around rectangles.
- **Routing curved Edges:** not planned. Little demand, and no well-bounded algorithm.
