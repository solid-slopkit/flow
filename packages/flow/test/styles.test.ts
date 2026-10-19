// flow.css reads the components theme's tokens and joins its cascade layers (ADR 0016). A renamed token or layer
// in @solid-slopkit/components would silently unstyle the Flow; this catches it.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const flowCss = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/styles/flow.css'), 'utf8');
const componentsCss = ['slopkit.css', 'default-theme.css']
  .map((file) => readFileSync(require.resolve(`@solid-slopkit/components/styles/${file}`), 'utf8'))
  .join('\n');
const layerOrder = (css: string) => css.match(/@layer [\w.]+(?:, [\w.]+)+;/)?.[0];

describe('flow.css', () => {
  test('declares the same layer order as the components', () => {
    expect(layerOrder(flowCss)).toBeDefined();
    expect(layerOrder(flowCss)).toBe(layerOrder(componentsCss));
  });

  test('every theme token it reads is defined by the components', () => {
    const read = [...flowCss.matchAll(/var\((--slp-(?!flow-)[\w-]+)/g)].map((match) => match[1]!);
    expect(read.length).toBeGreaterThan(0);
    expect(read.filter((token) => !componentsCss.includes(`${token}:`))).toEqual([]);
  });
});
