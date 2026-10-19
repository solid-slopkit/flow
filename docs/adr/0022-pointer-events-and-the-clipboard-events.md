# Pointer Events for every gesture, the clipboard through its events

Every gesture (pan, zoom, drag, Connection, the selection box, resizing, dragging from a palette) is built on Pointer Events with pointer capture: one code path for mouse, pen and touch. Dragging from a palette onto the Flow uses the same mechanism (`<FlowDraggable data>` and `onDrop({ data, position })`) rather than native HTML drag and drop, whose drag image can't be controlled and whose touch behaviour differs between browsers. By default the wheel zooms and dragging empty space pans; an option makes scrolling pan instead.

Copy, cut and paste use the system clipboard through the `copy`, `cut` and `paste` events, writing `application/x-slopkit-flow+json` and plain-text JSON. Within those events every baseline browser (ADR 0010) writes custom types, so copy and paste work between tabs and between Flows. Pasted Nodes get new ids from the Flow's `createId` (default `crypto.randomUUID()`), Edges among them are rewritten to the new ids, and Edges to Nodes outside the copied set are dropped. The app can transform the payload both ways.

## Considered Options

- **Native HTML drag and drop for the palette:** rejected, see above.
- **The asynchronous Clipboard API:** rejected. It does not write custom types in every baseline browser and asks for permission in some.
- **An in-memory clipboard:** rejected. It wouldn't reach another tab.
