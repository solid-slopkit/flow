// The LLM references are handwritten (ADR 0012). This keeps them in step with the code: every public export is
// mentioned, every link in src/llms.md resolves, and every reference is linked.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import * as flow from '../src/index';

const src = join(dirname(fileURLToPath(import.meta.url)), '../src');
const index = readFileSync(join(src, 'llms.md'), 'utf8');
const links = [...index.matchAll(/\]\(([^)#]+\.md)\)/g)].map((match) => match[1]);
const references = readdirSync(src, { recursive: true, encoding: 'utf8' })
  .filter((path) => path.endsWith('.md') && path !== 'llms.md')
  .map((path) => relative(src, join(src, path)).split('\\').join('/'));
const all = [index, ...references.map((reference) => readFileSync(join(src, reference), 'utf8'))].join('\n');

describe('LLM references', () => {
  test('every link in llms.md points at a file', () => {
    for (const link of links) expect(existsSync(join(src, link!)), link).toBe(true);
  });

  test('every reference is linked from llms.md', () => {
    expect(references.filter((reference) => !links.includes(reference))).toEqual([]);
  });

  test('every public export is mentioned', () => {
    const missing = Object.keys(flow).filter((name) => !new RegExp(`(^|[^\\w$])${name}([^\\w$]|$)`).test(all));
    expect(missing).toEqual([]);
  });
});
