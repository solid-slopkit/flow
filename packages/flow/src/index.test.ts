import { describe, expect, test } from 'vitest';

import * as flow from './index';

// The public runtime surface, pinned: adding or removing an export is a deliberate change.
const PUBLIC_API: string[] = [];

describe('public API', () => {
  test('exports exactly the pinned names', () => {
    expect(Object.keys(flow).sort()).toEqual(PUBLIC_API);
  });
});
