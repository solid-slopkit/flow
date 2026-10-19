import type { Component } from 'solid-js';
import { CodeBlock } from './CodeBlock';

/**
 * A live example above its source. Pass the module's default export and the same file
 * imported with `?raw`, so the code shown is always the code that runs.
 */
export function Example(props: { component: Component; code: string; column?: boolean }) {
  return (
    <figure class="docs-example">
      <div class="docs-example-preview" data-column={props.column ? '' : undefined}>
        <props.component />
      </div>
      <CodeBlock code={props.code} />
    </figure>
  );
}
