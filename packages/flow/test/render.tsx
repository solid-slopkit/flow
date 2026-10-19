// Renders inside <SlopkitUi>, as every app does (ADR 0016): the Flow's UI is built from components that need it.
import { SlopkitUi } from '@solid-slopkit/components';
import { render as baseRender } from '@solidjs/testing-library';
import type { JSX } from '@solidjs/web';

export function render(ui: () => JSX.Element) {
  return baseRender(() => <SlopkitUi>{ui()}</SlopkitUi>);
}
