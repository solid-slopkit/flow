// The Flow takes its look from the components theme, and the app's own CSS variables win (ADR 0016).
import { expect, test } from 'vitest';
import { render } from './render';

const background = (element: Element) => getComputedStyle(element).backgroundColor;

test('the Flow surface follows the theme', () => {
  const { getByTestId } = render(() => (
    <>
      <div data-testid="flow" class="slp-flow" />
      <div data-testid="surface" style={{ background: 'var(--slp-color-base-100)' }} />
    </>
  ));
  expect(background(getByTestId('flow'))).toBe(background(getByTestId('surface')));
});

test('a public variable set on an ancestor wins', () => {
  const { getByTestId } = render(() => (
    <div style={{ '--slp-flow-background': 'rgb(1, 2, 3)' }}>
      <div data-testid="flow" class="slp-flow" />
    </div>
  ));
  expect(background(getByTestId('flow'))).toBe('rgb(1, 2, 3)');
});
