# Layout through ELK behind an optional subpath

Layout is `@solid-slopkit/flow/layout`, an adapter over ELK (`elkjs`), declared as an optional peer dependency. Only that subpath imports it, and the main entry never imports the subpath, so an app that doesn't lay out its Flow never installs ELK. The adapter turns the Flow's Nodes (with their Measured or Declared sizes), Ports (with their sides) and Parents into ELK's input, and returns a Batch of `move` Changes, plus routes for Edges, which the app applies like any other edit. Layout is therefore undoable through the History without extra work.

ELK is chosen because it lays out Ports on given sides and nested Parents, both part of the model (ADR 0017, 0018). Lighter engines treat Nodes as plain boxes. ELK is large (about 1.5 MB unminified) and asynchronous, which a Batch-returning API absorbs; it can run in a Web Worker.

## Considered Options

- **No Layout in the package; the app runs an engine itself:** rejected. Every app would repeat the conversion between the Flow's records and the engine.
- **A layout algorithm written here:** rejected. Layered layout with crossing minimisation, Port order and nesting is a large research-heavy body of code to own.
