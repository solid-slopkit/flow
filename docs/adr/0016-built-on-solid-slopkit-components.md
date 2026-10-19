# Built on @solid-slopkit/components

The slopkit packages are meant to work together without seams, so `@solid-slopkit/flow` builds its own UI (Controls, MiniMap, menus, tooltips, Node resizers) from `@solid-slopkit/components` and takes its look from that package's theme. Flow's own stylesheet uses the same theme's custom properties, so a theme switch restyles the Flow with the rest of the app. `@solid-slopkit/components` is a peer dependency, so an app and the Flow share one copy, one provider and one stylesheet.

## Consequences

- An app that uses flow installs `@solid-slopkit/components` and its CSS, and sets up its provider.
- A breaking change to a component flow uses is a breaking change for flow. Flow's tests render the real components to catch it, and flow's peer range follows the components versions it was tested with.
- Inside Nodes, the app uses the same components directly; flow does not wrap them.

## Considered Options

- **Behaviour only, with a small structural stylesheet and plain elements for Controls and MiniMap:** rejected. The Flow would look foreign next to the rest of a slopkit app, and the app would restyle it by hand.
- **Shared theme tokens without importing the components:** rejected. It matches colours but not behaviour; menus, tooltips and buttons would be reimplemented here.
