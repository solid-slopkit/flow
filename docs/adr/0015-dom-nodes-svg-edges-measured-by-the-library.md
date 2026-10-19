# DOM Nodes, SVG Edges, sizes measured by the library

Nodes are absolutely positioned HTML elements inside one container transformed with `translate() scale()` for the Viewport. Edges are `<path>`s in an SVG layer under the same transform; Edge labels are HTML in a layer above it, so they can hold inputs and buttons. Nodes size themselves from their content: the library measures each Node and its Ports with `ResizeObserver` and keeps these Measured sizes as its own state, keyed by Node id. A Declared size in the app's data is used until, or instead of, a Measured one (ADR 0019).

This keeps Node content the app's real DOM: inputs, focus, text selection, CSS and accessibility work as on any page. The cost is a ceiling of a few thousand Nodes, which rendering only visible Nodes raises. That mode is opt-in and off by default, because unmounted Nodes are invisible to screen readers. While it is on, the last Measured size of an unmounted Node is kept, Nodes that are selected, focused, dragged or part of a Connection stay mounted, and keyboard moves between Nodes follow spatial order from the data, panning to a Node before focusing it.

## Considered Options

- **Canvas or WebGL:** rejected. It scales further, but Nodes could no longer be the app's JSX, and forms, focus and accessibility would have to be rebuilt.
- **All SVG with `<foreignObject>` Nodes:** rejected for its layout quirks and browser bugs with text input.
- **Writing Measured sizes into the app's data:** rejected. They follow from the page, not from user intent, and every resize would send a Batch through the app.
