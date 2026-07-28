import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContextMenu } from './ContextMenu';

afterEach(() => {
  vi.useRealTimers();
});

describe('ContextMenu', () => {
  it('keeps a toggle-style submenu item open until an outside click', () => {
    vi.useFakeTimers();
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const { getByRole } = render(
      <ContextMenu
        x={16}
        y={16}
        onClose={onClose}
        items={[
          {
            kind: 'submenu',
            id: 'labels',
            label: 'Labels',
            children: [
              {
                kind: 'item',
                id: 'label-option',
                label: 'Label A',
                closeOnSelect: false,
                onClick: onSelect,
              },
            ],
          },
        ]}
      />,
    );

    fireEvent.mouseEnter(getByRole('menuitem', { name: 'Labels' }));
    act(() => vi.advanceTimersByTime(100));
    const toggleItem = getByRole('menuitem', { name: 'Label A' });
    expect(fireEvent.mouseDown(toggleItem)).toBe(false);
    fireEvent.click(toggleItem);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(getByRole('menuitem', { name: 'Label A' })).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('still closes ordinary items after selection', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const { getByRole } = render(
      <ContextMenu
        x={16}
        y={16}
        onClose={onClose}
        items={[
          {
            kind: 'item',
            id: 'ordinary-action',
            label: 'Ordinary action',
            onClick: onSelect,
          },
        ]}
      />,
    );

    fireEvent.click(getByRole('menuitem', { name: 'Ordinary action' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
