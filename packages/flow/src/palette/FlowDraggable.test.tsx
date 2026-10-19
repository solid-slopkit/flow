import { flush } from 'solid-js';
import { describe, expect, test } from 'vitest';

import { render } from '../../test/render';
import { FlowDraggable } from './FlowDraggable';

describe('<FlowDraggable>', () => {
  test('renders its children in a draggable element with its class and style', () => {
    const { container } = render(() => (
      <FlowDraggable data={1} class="entry" style={{ color: 'red' }}>
        <span>Task</span>
      </FlowDraggable>
    ));
    const element = container.querySelector<HTMLElement>('[data-flow-draggable]')!;
    expect(element).toHaveClass('slp-flow-draggable', 'entry');
    expect(element.style.color).toBe('red');
    expect(element).toHaveTextContent('Task');
    expect(element).not.toHaveAttribute('data-dragging');
    expect(element).not.toHaveAttribute('data-disabled');
  });

  test('follows the pointer once past the threshold, and snaps back on release', () => {
    const { container } = render(() => <FlowDraggable data={1}>Task</FlowDraggable>);
    flush();
    const element = container.querySelector<HTMLElement>('[data-flow-draggable]')!;
    const pointer = (type: string, x: number, y: number) => {
      element.dispatchEvent(
        new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: 'mouse', clientX: x, clientY: y }),
      );
      flush();
    };
    pointer('pointerdown', 10, 10);
    pointer('pointermove', 12, 10);
    expect(element).not.toHaveAttribute('data-dragging');
    pointer('pointermove', 40, 30);
    expect(element).toHaveAttribute('data-dragging');
    expect(element.style.transform).toBe('translate(30px, 20px)');
    pointer('pointercancel', 40, 30);
    expect(element).not.toHaveAttribute('data-dragging');
    expect(element.style.transform).toBe('');
  });

  test('a disabled one doesn’t drag', () => {
    const { container } = render(() => (
      <FlowDraggable data={1} disabled>
        Task
      </FlowDraggable>
    ));
    flush();
    const element = container.querySelector<HTMLElement>('[data-flow-draggable]')!;
    expect(element).toHaveAttribute('data-disabled');
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 0, clientY: 0 }));
    element.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 50, clientY: 0 }));
    flush();
    expect(element).not.toHaveAttribute('data-dragging');
  });
});
