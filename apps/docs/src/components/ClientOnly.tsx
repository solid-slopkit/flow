import { createSignal, onSettled, Show, type ParentProps } from 'solid-js';
import type { JSX } from '@solidjs/web';

/**
 * Renders its children only in the browser, after hydration; the server and the first client render show `fallback`.
 * The Flow doesn't hydrate yet (roadmap F8.01), so live Flow examples mount this way until it does.
 */
export function ClientOnly(props: ParentProps<{ fallback?: JSX.Element }>) {
  const [mounted, setMounted] = createSignal(false, { name: 'clientOnlyMounted' });
  onSettled(() => {
    setMounted(true);
  });
  return (
    <Show when={mounted()} fallback={props.fallback}>
      {props.children}
    </Show>
  );
}
