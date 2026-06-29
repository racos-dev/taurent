/**
 * RetryButton component tests
 *
 * Tests:
 * - renders with default label "Retry"
 * - renders with custom label
 * - calls onClick on click
 * - passes className through
 */

import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { RetryButton } from './RetryButton';

describe('RetryButton', () => {
  it('renders with default label "Retry"', () => {
    const { getByText } = render(<RetryButton onClick={vi.fn()} />);
    expect(getByText('Retry')).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    const { getByText } = render(<RetryButton onClick={vi.fn()} label="Try Again" />);
    expect(getByText('Try Again')).toBeInTheDocument();
  });

  it('calls onClick on click', () => {
    const onClick = vi.fn();
    const { getByRole } = render(<RetryButton onClick={onClick} />);
    fireEvent.click(getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('passes className through', () => {
    const { getByRole } = render(<RetryButton onClick={vi.fn()} className="custom-class" />);
    expect(getByRole('button')).toHaveClass('custom-class');
  });

  it('has displayName set', () => {
    expect((RetryButton as unknown as { displayName: string }).displayName).toBe('RetryButton');
  });
});