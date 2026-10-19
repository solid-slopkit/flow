import { SegmentedControl } from '@solid-slopkit/components';
import { THEMES, type DocsTheme } from './preferences';

const LABELS: Record<DocsTheme, string> = { default: 'Default', orange: 'Orange', green: 'Green' };

export function ThemeSwitcher(props: { theme: DocsTheme; onChange: (theme: DocsTheme) => void }) {
  return (
    <SegmentedControl
      class="docs-theme-switcher"
      aria-label="Theme"
      size="xs"
      color="primary"
      data={THEMES.map((value) => ({ value, label: LABELS[value] }))}
      value={props.theme}
      onChange={props.onChange}
    />
  );
}
