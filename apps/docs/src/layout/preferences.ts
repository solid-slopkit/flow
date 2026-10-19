// The docs' theme preference. The color scheme preference is the provider's (useColorScheme()).

export const THEMES = ['default', 'orange', 'green'] as const;
export type DocsTheme = (typeof THEMES)[number];

// Themes that support only one color scheme, and so pin it.
export const PINNED_SCHEME: Partial<Record<DocsTheme, 'light' | 'dark'>> = { green: 'light' };

const THEME_KEY = 'slp-docs-theme';

// Runs in <head> before first paint, so a saved theme never flashes the default.
export const themeScript = `try{var t=localStorage.getItem('${THEME_KEY}');if(${JSON.stringify(THEMES.slice(1))}.indexOf(t)>=0)document.documentElement.dataset.slpTheme=t}catch(e){}`;

function save(value: string | undefined) {
  try {
    if (value === undefined) localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, value);
  } catch {
    // Storage blocked: the choice still applies to this page.
  }
}

export function readTheme(): DocsTheme {
  const theme = document.documentElement.dataset.slpTheme;
  return (THEMES as readonly string[]).includes(theme ?? '') ? (theme as DocsTheme) : 'default';
}

export function applyTheme(theme: DocsTheme) {
  const value = theme === 'default' ? undefined : theme;
  if (value) document.documentElement.dataset.slpTheme = value;
  else delete document.documentElement.dataset.slpTheme;
  save(value);
}
