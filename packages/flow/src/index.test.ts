import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

import * as flow from './index';
import * as layout from './layout/index';

// The public runtime surface, pinned: adding or removing an export is a deliberate change.
const PUBLIC_API: string[] = [
  'Background',
  'Controls',
  'Edge',
  'EdgePath',
  'Flow',
  'FlowDraggable',
  'MiniMap',
  'Node',
  'NodeResizer',
  'Port',
  'absolutePosition',
  'applyChanges',
  'bezierShape',
  'createHistory',
  'edgeEnds',
  'edgeShapes',
  'floatingPoint',
  'indexFlow',
  'invert',
  'nodeBounds',
  'portPoint',
  'removal',
  'routeOrthogonal',
  'routedStepShape',
  'smoothStepShape',
  'stepShape',
  'straightShape',
  'useEdge',
  'useFlow',
  'useNode',
];

describe('public API', () => {
  test('exports exactly the pinned names', () => {
    expect(Object.keys(flow).sort()).toEqual(PUBLIC_API);
  });
});

describe('the layout subpath', () => {
  test('exports exactly the pinned names', () => {
    expect(Object.keys(layout).sort()).toEqual(['elkInWorker', 'layout']);
  });

  test('the main entry never imports it, nor ELK', () => {
    const src = dirname(fileURLToPath(import.meta.url));
    const seen = new Set<string>();
    const bare = new Set<string>();
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const code = readFileSync(file, 'utf8');
      for (const [, specifier] of code.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)) {
        if (!specifier!.startsWith('.')) bare.add(specifier!);
        else {
          const base = resolve(dirname(file), specifier!);
          visit(
            [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((candidate) => {
              try {
                return readFileSync(candidate) && true;
              } catch {
                return false;
              }
            })!,
          );
        }
      }
    };
    visit(join(src, 'index.ts'));
    expect([...seen].filter((file) => file.includes('/layout/'))).toEqual([]);
    expect([...bare].filter((specifier) => specifier.startsWith('elkjs'))).toEqual([]);
    expect(seen.size).toBeGreaterThan(20);
  });
});
