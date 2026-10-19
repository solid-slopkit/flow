import { createSignal, For, onSettled } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { FileText, Search as SearchIcon } from '@lucide/solid';
import { Button, Command, CommandDialog, Kbd } from '@solid-slopkit/components';
import { nav, type NavItem } from '../nav';

// Every page in the sidebar, under the same headings: a section's own pages, then each of its groups.
// Found by their titles only: the search hides what it doesn't find without ranking the rest, so a heading's words
// would bring back every page under it.
const groups = nav.flatMap((section) => [
  { heading: section.title, items: section.items },
  ...(section.groups ?? []).map((group) => ({ heading: group.title, items: group.items })),
]);

// The header's search over the docs' pages. ⌘K (Ctrl+K elsewhere) opens it from anywhere.
export function Search() {
  const navigate = useNavigate();
  const [opened, setOpened] = createSignal(false, { name: 'search.opened' });
  // The server can't know the platform, so both sides render Ctrl and the client switches once hydrated.
  const [apple, setApple] = createSignal(false, { name: 'search.apple' });
  onSettled(() => {
    setApple(/mac|iphone|ipad|ipod/i.test(navigator.platform));
  });

  const go = (item: NavItem) => () => navigate(item.href);

  return (
    <>
      <Button
        class="docs-search-button"
        aria-label="Search the docs"
        variant="outline"
        size="sm"
        leftSection={<SearchIcon />}
        rightSection={<Kbd size="xs">{apple() ? '⌘K' : 'Ctrl K'}</Kbd>}
        onClick={() => setOpened(true)}
      >
        <span class="docs-search-label">Search</span>
      </Button>
      <CommandDialog opened={opened()} onOpenedChange={setOpened} aria-label="Search the docs">
        <Command.Input placeholder="Search the docs…" />
        <Command.List aria-label="Pages">
          <Command.Empty>No page found</Command.Empty>
          <For each={groups}>
            {(group) => (
              <Command.Group heading={group.heading}>
                <For each={group.items}>
                  {(item) => (
                    <Command.Item onSelect={go(item)}>
                      <FileText />
                      {item.title}
                    </Command.Item>
                  )}
                </For>
              </Command.Group>
            )}
          </For>
        </Command.List>
      </CommandDialog>
    </>
  );
}
