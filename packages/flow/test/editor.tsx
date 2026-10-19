// A small editor for tests: the state in a store, every Batch applied with applyChanges and recorded, a <Node> per
// record with its id as content.
import { createStore, For, snapshot } from 'solid-js';
import type { JSX } from '@solidjs/web';

import { applyChanges } from '../src/changes/apply';
import type { Batch } from '../src/changes/changes';
import { Flow, useFlow, type FlowApi, type FlowProps } from '../src/flow/Flow';
import type { FlowNode, FlowState } from '../src/model/model';
import { Node, type NodeProps } from '../src/node/Node';
import { render } from './render';

export interface EditorOptions {
  flow?: Partial<FlowProps>;
  node?: (node: FlowNode) => Partial<NodeProps>;
  content?: (node: FlowNode) => JSX.Element;
  /** Apply Batches to the store (default) or only record them. */
  apply?: boolean;
}

export function renderEditor(initial: FlowState, options: EditorOptions = {}) {
  const [state, setState] = createStore<FlowState>(structuredClone(initial));
  const batches: Batch[] = [];
  let api!: FlowApi;
  const Probe = () => {
    api = useFlow();
    return null;
  };
  const result = render(() => (
    <Flow
      state={state}
      onChange={(batch) => {
        batches.push(structuredClone(batch));
        if (options.apply ?? true) applyChanges(setState, batch);
      }}
      style={{ width: '600px', height: '400px' }}
      {...options.flow}
    >
      <Probe />
      <For each={state.nodes}>
        {(node) => (
          <Node id={node.id} {...options.node?.(node)}>
            {options.content ? options.content(node) : <div style={{ padding: '4px' }}>{node.id}</div>}
          </Node>
        )}
      </For>
    </Flow>
  ));
  const nodeElement = (id: string) => result.container.querySelector<HTMLElement>(`[data-flow-node="${id}"]`)!;
  return {
    ...result,
    state,
    setState,
    plain: () => snapshot(state) as FlowState,
    batches,
    api: () => api,
    nodeElement,
    root: () => result.container.querySelector<HTMLElement>('.slp-flow')!,
  };
}
