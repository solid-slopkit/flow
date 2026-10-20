import { ActionIcon } from '@solid-slopkit/components';
import { Show } from 'solid-js';
import type { JSX } from '@solidjs/web';

import { useFlow, type FitViewOptions } from '../flow/Flow';
import { useFlowInternals } from '../flow/internals';
import { FitIcon, LockIcon, MinusIcon, PlusIcon } from './icons';
import { drawInLayer, panelClass, type PanelPosition } from './panel';

export interface ControlsProps {
  /** Defaults to `bottom-left`. */
  position?: PanelPosition;
  /** Defaults to `vertical`. */
  orientation?: 'horizontal' | 'vertical';
  /** The zoom in and zoom out buttons. Defaults to `true`. */
  showZoom?: boolean;
  /** The fit view button. Defaults to `true`. */
  showFitView?: boolean;
  /** The lock button, which locks and unlocks editing. Defaults to `true`. */
  showLock?: boolean;
  /** What the fit view button fits, and its padding. */
  fitViewOptions?: FitViewOptions;
  /** The group's name for assistive technology. Defaults to `messages.controls`. */
  'aria-label'?: string;
  class?: string;
  style?: JSX.CSSProperties;
  /** More buttons, after the built-in ones: usually `ActionIcon`s from `@solid-slopkit/components`. */
  children?: JSX.Element;
}

/**
 * Buttons over the Flow, in a corner: zoom in, zoom out, fit view, and lock editing. Render it inside a `<Flow>`.
 */
export function Controls(props: ControlsProps): JSX.Element {
  const flow = useFlow();
  const internals = useFlowInternals();
  const messages = () => internals.messages();
  const orientation = () => props.orientation ?? 'vertical';

  drawInLayer(
    'panel',
    <div
      class={panelClass('slp-flow-controls', props.class)}
      data-flow-panel
      data-position={props.position ?? 'bottom-left'}
      data-orientation={orientation()}
      role="group"
      aria-label={props['aria-label'] ?? messages().controls}
      style={props.style}
    >
      <Show when={props.showZoom ?? true}>
        <ActionIcon label={messages().zoomIn} title={messages().zoomIn} size="sm" onClick={() => flow.zoomIn()}>
          <PlusIcon />
        </ActionIcon>
        <ActionIcon label={messages().zoomOut} title={messages().zoomOut} size="sm" onClick={() => flow.zoomOut()}>
          <MinusIcon />
        </ActionIcon>
      </Show>
      <Show when={props.showFitView ?? true}>
        <ActionIcon
          label={messages().fitView}
          title={messages().fitView}
          size="sm"
          onClick={() => flow.fitView(props.fitViewOptions)}
        >
          <FitIcon />
        </ActionIcon>
      </Show>
      <Show when={props.showLock ?? true}>
        <ActionIcon
          label={messages().lock}
          title={messages().lock}
          size="sm"
          active={flow.locked()}
          aria-pressed={flow.locked() ? 'true' : 'false'}
          onClick={() => flow.setLocked(!flow.locked())}
        >
          <LockIcon locked={flow.locked()} />
        </ActionIcon>
      </Show>
      {props.children}
    </div>,
  );
  return undefined;
}
