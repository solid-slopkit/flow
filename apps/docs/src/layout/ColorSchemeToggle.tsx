import { Button, useColorScheme } from '@solid-slopkit/components';
import { Moon, Sun } from '@lucide/solid';

// With no saved choice the docs follow the OS. The icon is picked in CSS rather than from
// resolvedColorScheme(), so it is right on first paint: the server can't know the stored preference.
export function ColorSchemeToggle(props: { pinned: boolean }) {
  const scheme = useColorScheme();
  return (
    <Button
      class="docs-scheme-toggle"
      variant="ghost"
      shape="square"
      size="sm"
      aria-label="Toggle color scheme"
      title={props.pinned ? 'This theme supports only one color scheme' : undefined}
      disabled={props.pinned}
      onClick={() => scheme.toggleColorScheme()}
    >
      <Moon class="docs-scheme-icon-light" />
      <Sun class="docs-scheme-icon-dark" />
    </Button>
  );
}
