// Every example renders inside the provider, as on its page, without throwing, and draws its Flow.
import { flush, type Component } from 'solid-js';
import { SlopkitUi } from '@solid-slopkit/components';
import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, test } from 'vitest';

const examples = import.meta.glob<{ default: Component }>('./*.tsx', { eager: true });

afterEach(cleanup);

describe('examples', () => {
  test('there are some', () => {
    expect(Object.keys(examples).length).toBeGreaterThan(5);
  });

  for (const [path, module] of Object.entries(examples)) {
    test(path, () => {
      const Example = module.default;
      const { container } = render(() => (
        <SlopkitUi>
          <Example />
        </SlopkitUi>
      ));
      flush();
      expect(container.querySelector('.slp-flow')).not.toBeNull();
    });
  }
});
