import { For } from 'solid-js';
import type { JSX } from '@solidjs/web';

/** A plain table for guide pages: a header row, then one array of cells per row. */
export function DocTable(props: { head: string[]; rows: JSX.Element[][] }) {
  return (
    <div class="docs-table-wrap">
      <table class="docs-table">
        <thead>
          <tr>
            <For each={props.head}>{(cell) => <th>{cell}</th>}</For>
          </tr>
        </thead>
        <tbody>
          <For each={props.rows}>
            {(row) => (
              <tr>
                <For each={row}>{(cell) => <td>{cell}</td>}</For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
