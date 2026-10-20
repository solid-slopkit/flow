import { createMemo, createUniqueId, Match, Switch } from 'solid-js';
import type { JSX } from '@solidjs/web';

import { useFlow } from '../flow/Flow';
import { drawInLayer } from './panel';

export type BackgroundVariant = 'dots' | 'lines' | 'cross';

export interface BackgroundProps {
  /** Defaults to `dots`. */
  variant?: BackgroundVariant;
  /** The spacing of the pattern in Flow coordinates: one number, or `[x, y]`. Defaults to 20. */
  gap?: number | readonly [number, number];
  /** In Flow coordinates: a dot's diameter (default 2), or a cross's width and height (default 6). Lines ignore it. */
  size?: number;
  /** The stroke width of lines and crosses, in screen pixels. Defaults to 1. */
  lineWidth?: number;
  /** Shifts the pattern, in Flow coordinates: one number, or `[x, y]`. Defaults to 0. */
  offset?: number | readonly [number, number];
  /** The pattern's color. Defaults to `--slp-flow-pattern-color`. */
  color?: string;
  class?: string;
  style?: JSX.CSSProperties;
}

const pair = (value: number | readonly [number, number] | undefined, fallback: number): [number, number] =>
  value === undefined ? [fallback, fallback] : typeof value === 'number' ? [value, value] : [value[0], value[1]];

const cross = (cx: number, cy: number, half: number) => `M ${cx - half} ${cy} H ${cx + half} M ${cx} ${cy - half} V ${cy + half}`;

/**
 * A pattern of dots, lines or crosses behind the Flow's Nodes and Edges, that pans and zooms with the Viewport. Render
 * it inside a `<Flow>`; several Backgrounds stack, the first lowest.
 */
export function Background(props: BackgroundProps): JSX.Element {
  const flow = useFlow();
  const id = createUniqueId();
  const variant = () => props.variant ?? 'dots';
  // One tile of the pattern in screen pixels, centred on a grid point, so a dot or cross is never cut by the tile.
  const tile = createMemo(
    () => {
      const { x, y, zoom } = flow.viewport();
      const [gapX, gapY] = pair(props.gap, 20);
      const [offsetX, offsetY] = pair(props.offset, 0);
      const width = gapX * zoom;
      const height = gapY * zoom;
      return { x: x + offsetX * zoom - width / 2, y: y + offsetY * zoom - height / 2, width, height, zoom };
    },
    { name: 'background:tile' },
  );
  const half = (size: number) => (size * tile().zoom) / 2;

  drawInLayer(
    'background',
    <svg
      class={props.class ? `slp-flow-background ${props.class}` : 'slp-flow-background'}
      data-variant={variant()}
      style={{ color: props.color, ...props.style }}
      aria-hidden="true"
    >
      <pattern
        id={id}
        patternUnits="userSpaceOnUse"
        x={tile().x}
        y={tile().y}
        width={tile().width}
        height={tile().height}
        stroke-width={props.lineWidth ?? 1}
      >
        <Switch fallback={<circle cx={tile().width / 2} cy={tile().height / 2} r={half(props.size ?? 2)} />}>
          <Match when={variant() === 'lines'}>
            <path d={`M ${tile().width / 2} 0 V ${tile().height} M 0 ${tile().height / 2} H ${tile().width}`} />
          </Match>
          <Match when={variant() === 'cross'}>
            <path d={cross(tile().width / 2, tile().height / 2, half(props.size ?? 6))} />
          </Match>
        </Switch>
      </pattern>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>,
  );
  return undefined;
}
