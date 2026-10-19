import { Show } from 'solid-js';
import type { JSX } from '@solidjs/web';

import { bezierShape } from '../edge/shapes';
import { useFlowInternals } from '../flow/internals';

/** The preview line of the Connection being dragged, above the Nodes. Empty while there is none. */
export function ConnectionLine(): JSX.Element {
  const internals = useFlowInternals();
  return (
    <svg class="slp-flow-connection" data-flow-pane>
      <Show when={internals.connection()}>
        {(connection) => (
          <path
            class="slp-flow-connection-path"
            d={bezierShape(connection().fromPoint, connection().toPoint).d}
            data-valid={connection().to ? '' : undefined}
          />
        )}
      </Show>
    </svg>
  );
}
