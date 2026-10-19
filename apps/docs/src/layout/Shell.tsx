import type { ParentProps } from 'solid-js';
import { AppShell } from '@solid-slopkit/components';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

// The docs' frame. On a narrow screen the sidebar is a drawer, which a press on one of its links closes.
export function Shell(props: ParentProps) {
  return (
    <AppShell>
      <Sidebar />
      <AppShell.Main>
        <Header />
        <div class="docs-content">{props.children}</div>
      </AppShell.Main>
    </AppShell>
  );
}
