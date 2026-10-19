# No right-to-left support

The library supports left-to-right languages only. Components aren't tested under `dir="rtl"`, keyboard navigation doesn't flip arrow keys for it, and the docs site has no RTL toggle.

Component CSS may still use logical properties (`padding-inline-start`, `margin-inline`), since they cost nothing in LTR. But nothing promises a layout that is correct in RTL.

## Considered Options

- **Full RTL support:** rejected for now. It adds a check to every component's definition of done (layout and arrow keys under `dir="rtl"`, docs pages verified in both directions), plus direction handling in the keyboard primitives and in positioning, for languages this library's users don't target.

## Consequences

- An app for an RTL language would need its own CSS overrides, and keyboard navigation would still follow LTR order.
- Adding RTL later is additive, but it would need a pass over every component and keyboard primitive.
