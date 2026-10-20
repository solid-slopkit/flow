// The built-in UI's icons: 16px line drawings in the current text color, hidden from assistive technology (each
// button is named by its label).
import type { JSX } from '@solidjs/web';

function Icon(props: { children: JSX.Element }): JSX.Element {
  return (
    <svg
      class="slp-flow-icon"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {props.children}
    </svg>
  );
}

export const PlusIcon = () => (
  <Icon>
    <path d="M8 3v10M3 8h10" />
  </Icon>
);

export const MinusIcon = () => (
  <Icon>
    <path d="M3 8h10" />
  </Icon>
);

/** Four corners: show everything. */
export const FitIcon = () => (
  <Icon>
    <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
  </Icon>
);

/** A padlock, closed while locked and open while not. */
export const LockIcon = (props: { locked: boolean }) => (
  <Icon>
    <rect x="3" y="7.5" width="10" height="6.5" rx="1.25" />
    <path d={props.locked ? 'M5.5 7.5V5a2.5 2.5 0 0 1 5 0v2.5' : 'M5.5 7.5V5a2.5 2.5 0 0 1 4.9-.7'} />
  </Icon>
);
