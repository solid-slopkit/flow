import { For } from 'solid-js';
import type { JSX } from '@solidjs/web';

export interface PropDoc {
  name: string;
  type: string;
  default?: string;
  description: JSX.Element;
}

export function PropsTable(props: { rows: PropDoc[] }) {
  return (
    <div class="docs-table-wrap">
      <table class="docs-table">
        <thead>
          <tr>
            <th>Prop</th>
            <th>Type</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <For each={props.rows}>
            {(row) => (
              <tr>
                <td>
                  <code>{row.name}</code>
                </td>
                <td>
                  <code>{row.type}</code>
                </td>
                <td>{row.default ? <code>{row.default}</code> : '—'}</td>
                <td>{row.description}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}

export interface CssVarDoc {
  name: string;
  default: string;
  description: JSX.Element;
}

export function CssVarsTable(props: { rows: CssVarDoc[] }) {
  return (
    <div class="docs-table-wrap">
      <table class="docs-table">
        <thead>
          <tr>
            <th>Variable</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <For each={props.rows}>
            {(row) => (
              <tr>
                <td>
                  <code>{row.name}</code>
                </td>
                <td>
                  <code>{row.default}</code>
                </td>
                <td>{row.description}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
