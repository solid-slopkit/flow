import type { HighlighterCore } from 'shiki/core';

export type CodeLang = 'tsx' | 'css' | 'bash' | 'jsonc';

let highlighter: Promise<HighlighterCore> | undefined;

// Shiki is loaded on first use and only with the languages the docs need, using the
// JavaScript regex engine so no WASM is shipped.
function getHighlighter() {
  highlighter ??= Promise.all([import('shiki/core'), import('shiki/engine/javascript')]).then(
    ([{ createHighlighterCore }, { createJavaScriptRegexEngine }]) =>
      createHighlighterCore({
        themes: [import('shiki/themes/github-light.mjs'), import('shiki/themes/github-dark.mjs')],
        langs: [
          import('shiki/langs/tsx.mjs'),
          import('shiki/langs/css.mjs'),
          import('shiki/langs/bash.mjs'),
          import('shiki/langs/jsonc.mjs'),
        ],
        engine: createJavaScriptRegexEngine(),
      }),
  );
  return highlighter;
}

export async function highlight(code: string, lang: CodeLang): Promise<string> {
  // light-dark() colors follow the color scheme of the code block, so a scheme switch needs no re-highlighting.
  return (await getHighlighter()).codeToHtml(code, {
    lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: 'light-dark()',
  });
}
