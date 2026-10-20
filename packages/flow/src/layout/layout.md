# Layout

`@solid-slopkit/flow/layout` places a Flow's Nodes automatically with ELK (`elkjs`), and returns a Batch of Changes the app applies like any other edit, so a Layout goes through the History and can be undone (ADR 0020).

```bash
pnpm add elkjs
```

`elkjs` is an optional peer dependency. Only this subpath imports it, and the main entry `@solid-slopkit/flow` never imports this subpath, so an app that doesn't lay out its Flow neither installs nor loads ELK.

```tsx
import { applyChanges, useFlow } from '@solid-slopkit/flow';
import { layout } from '@solid-slopkit/flow/layout';

// Inside the Flow (a button among the Controls, say):
const flow = useFlow();
const arrange = async () => {
  applyChanges(setState, await layout(flow.state(), { measured: flow }));
  requestAnimationFrame(() => flow.fitView());
};
```

## `layout(state, options?)`

```ts
function layout<N, E>(state: FlowState<N, E>, options?: LayoutOptions<E>): Promise<Batch<N, E>>;

interface LayoutOptions<E> {
  options?: Record<string, string>; // ELK's layout options for the whole graph, over the defaults
  measured?: LayoutMeasurements; // Measured sizes and Ports: `useFlow()` fits
  route?: (edge: FlowEdge<E>) => boolean; // which Edges get a route; default: `shape: 'routed-step'`
  elk?: ELK; // the ELK instance to run; default: elkjs's bundled build, loaded on first use
}

interface LayoutMeasurements {
  measuredSize(id: string): Size | undefined;
  measuredPort(node: string, port: string): MeasuredPort | undefined;
}
```

What goes into ELK:

- Every Node, with its Measured size, else its Declared size, else none. A Node whose Parents run into a missing Node or a cycle is laid out at the top level.
- Each Node's Ports (those it declares and those its Edges name), at their measured point, else their declared one, on their side. Their places are fixed: ELK lays out round them.
- Parents, with their children inside them (`elk.hierarchyHandling: INCLUDE_CHILDREN`).
- Every Edge whose Nodes exist, from Port to Port; a Floating end attaches to its Node.

The defaults, which `options` overrides key by key: `elk.algorithm: layered`, `elk.direction: RIGHT`, `elk.edgeRouting: ORTHOGONAL`, `elk.spacing.nodeNode: 40`, `elk.layered.spacing.nodeNodeBetweenLayers: 60`, and no padding round the whole graph, which starts at `(0, 0)`.

What comes back, a one-shot Batch (no `phase`), in this order:

- `move` for each Node ELK placed elsewhere, relative to its Parent (ADR 0017).
- `resize` (with its new position) for each Parent with a Declared size that no longer fits its children. A Parent sized by its content only moves.
- `update` of `route` for each Edge `route` accepts: ELK's route from end to end, in Flow coordinates.

Changes that would change nothing are left out: laying out a laid-out Flow returns no Changes. Each Change carries the value it replaces, so `invert(batch)` undoes it.

## In a Web Worker

`elkInWorker(workerUrl)` returns an ELK running in a Web Worker started from `workerUrl`: the URL of elkjs's `lib/elk-worker.min.js`, as the app's bundler serves it. Only ELK's small API loads on the page. Pass it as `elk`; `elk.terminateWorker()` stops the Worker.

```tsx
import { elkInWorker, layout, type ELK } from '@solid-slopkit/flow/layout';
import workerUrl from 'elkjs/lib/elk-worker.min.js?url'; // a Vite URL import; other bundlers have their own

let elk: ELK | undefined; // started on first use: there is no Worker on the server
const batch = await layout(flow.state(), { measured: flow, elk: (elk ??= elkInWorker(workerUrl)) });
```

## Routes

`FlowEdge.route` holds a Layout's route. A routed step Edge (see [routing](../routing/routing.md)) draws it while it still joins the Edge's ends (within half a unit) with horizontal and vertical runs, and crosses no Node. Once a Node moves one of its ends, or into its way, the Edge is routed again round the Nodes; the record keeps the old `route` until the next Layout. Other Edge shapes ignore `route`.
