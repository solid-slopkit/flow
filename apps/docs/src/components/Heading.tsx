import type { ParentProps } from 'solid-js';

/** A section heading with a link to itself. */
export function H2(props: ParentProps<{ id: string }>) {
  return (
    <h2 id={props.id} class="docs-heading">
      <a href={`#${props.id}`}>{props.children}</a>
    </h2>
  );
}
