# Server rendering from Declared sizes

A Flow renders on the server. Nodes always render at their positions. Edges render too when the geometry they need is in the data: each Node at either end has a Declared size (`size`), and each Port it attaches to is declared in the Node's `ports` with its side and offset. The library's geometry reads "Measured size, else Declared size" everywhere, and never touches `window` or measures during render. Without declared geometry, Edges are drawn on the client once the Nodes are measured. `fitView` on the server needs the Flow's own declared width and height, since there is no container to measure.

This gives full static diagrams (docs, previews, generated pages) without a browser, at the cost of keeping all layout math independent of the DOM.

## Considered Options

- **Server-safe, Edges always drawn on the client:** rejected as the only mode. Static diagrams would lose their Edges, which are half of what they show.
- **Client-only, the app wraps the Flow in its own boundary:** rejected. Every app would repeat the wrapper, and the docs site prerenders.
