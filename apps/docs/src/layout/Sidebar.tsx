import { For } from 'solid-js';
import { useLocation } from '@solidjs/router';
import { AppShell } from '@solid-slopkit/components';
import { nav, type NavItem } from '../nav';
import { isPath, withBase } from '../base';

function NavMenu(props: { items: NavItem[] }) {
  const location = useLocation();
  return (
    <AppShell.Menu>
      <For each={props.items}>
        {(item) => (
          <AppShell.MenuItem>
            <AppShell.MenuButton href={withBase(item.href)} active={isPath(location.pathname, item.href)}>
              {item.title}
            </AppShell.MenuButton>
          </AppShell.MenuItem>
        )}
      </For>
    </AppShell.Menu>
  );
}

// Plain anchors, which the router navigates through; each row marks itself current from the location.
export function Sidebar() {
  return (
    <AppShell.Sidebar label="Navigation" class="docs-sidebar">
      <AppShell.SidebarHeader class="docs-sidebar-header">
        <a class="docs-wordmark" href={withBase('/')}>
          slopkit
        </a>
      </AppShell.SidebarHeader>
      <AppShell.SidebarContent>
        <nav aria-label="Documentation">
          <For each={nav}>
            {(section) => (
              <>
                <AppShell.Group label={section.title} class="docs-nav-section">
                  <NavMenu items={section.items} />
                </AppShell.Group>
                <For each={section.groups ?? []}>
                  {(group) => (
                    <AppShell.Group label={group.title}>
                      <NavMenu items={group.items} />
                    </AppShell.Group>
                  )}
                </For>
              </>
            )}
          </For>
        </nav>
      </AppShell.SidebarContent>
      <AppShell.Rail />
    </AppShell.Sidebar>
  );
}
