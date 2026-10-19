import { createSignal, onSettled } from 'solid-js';
import { AppShell } from '@solid-slopkit/components';
import { ColorSchemeToggle } from './ColorSchemeToggle';
import { Search } from './Search';
import { ThemeSwitcher } from './ThemeSwitcher';
import { applyTheme, PINNED_SCHEME, readTheme, type DocsTheme } from './preferences';
import { withBase } from '../base';

export function Header() {
  // The server can't know the saved theme, so both sides render the default and the client catches up with
  // what the head script applied once hydration settles.
  const [theme, setTheme] = createSignal<DocsTheme>('default', { name: 'theme' });
  onSettled(() => {
    setTheme(readTheme());
  });

  const changeTheme = (next: DocsTheme) => {
    applyTheme(next);
    setTheme(next);
  };

  return (
    <header class="docs-header">
      <AppShell.Trigger label="Toggle navigation" />
      {/* The sidebar has the wordmark; on a narrow screen, where it's a drawer, the header shows it. */}
      <a class="docs-wordmark docs-header-wordmark" href={withBase('/')}>
        slopkit
      </a>
      <div class="docs-header-actions">
        <Search />
        <ThemeSwitcher theme={theme()} onChange={changeTheme} />
        <ColorSchemeToggle pinned={PINNED_SCHEME[theme()] !== undefined} />
      </div>
    </header>
  );
}
