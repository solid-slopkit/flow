// The `@solid-slopkit/flow/layout` entry (ADR 0020). The main entry never imports it, so only apps that lay out their
// Flow load ELK.
import type { ELK } from 'elkjs/lib/elk-api.js';
import ElkApi from 'elkjs/lib/elk-api.js';

export { layout, type LayoutMeasurements, type LayoutOptions } from './layout';
export type { ELK } from 'elkjs/lib/elk-api.js';

/**
 * ELK running in a Web Worker started from `workerUrl`, the URL of elkjs's `lib/elk-worker.min.js` as the app's bundler
 * serves it. Only ELK's small API loads on the page; pass the result as `layout`'s `elk` option.
 */
export function elkInWorker(workerUrl: string | URL): ELK {
  const Elk = ElkApi as unknown as new (args: { workerUrl: string }) => ELK;
  return new Elk({ workerUrl: String(workerUrl) });
}
