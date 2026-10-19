// The browser project's smoke test: a component renders into a real Chromium page with real layout, which jsdom
// doesn't have.
import { render } from '@solidjs/testing-library';
import { expect, test } from 'vitest';

test('a rendered element is laid out', () => {
  const { getByTestId } = render(() => <div data-testid="box" style={{ width: '120px', height: '80px' }} />);
  const box = getByTestId('box').getBoundingClientRect();
  expect([box.width, box.height]).toEqual([120, 80]);
});
