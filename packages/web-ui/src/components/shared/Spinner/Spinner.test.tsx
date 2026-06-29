/**
 * Spinner component tests
 *
 * Tests:
 * - ring variant renders with animate-spin and correct size classes
 * - icon variant renders RefreshCw with correct size
 * - size classes applied correctly for sm/md/lg
 * - className is merged via cn()
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('renders ring variant by default', () => {
    const { container } = render(<Spinner />);
    const el = container.firstChild as HTMLElement;
    expect(el.tagName.toLowerCase()).toBe('span');
    expect(el.className).toContain('animate-spin');
    expect(el.className).toContain('rounded-full');
    expect(el.className).toContain('border-2');
    expect(el.className).toContain('border-current');
    expect(el.className).toContain('border-t-transparent');
  });

  it('renders icon variant with RefreshCw', () => {
    const { container } = render(<Spinner variant="icon" />);
    const el = container.firstChild as HTMLElement;
    expect(el.tagName.toLowerCase()).toBe('svg');
    expect(el.className).toContain('text-current');
  });

  it('applies sm size classes for ring variant', () => {
    const { container } = render(<Spinner size="sm" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('h-3');
    expect(el.className).toContain('w-3');
  });

  it('applies md size classes for ring variant', () => {
    const { container } = render(<Spinner size="md" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('h-4');
    expect(el.className).toContain('w-4');
  });

  it('applies lg size classes for ring variant', () => {
    const { container } = render(<Spinner size="lg" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('h-12');
    expect(el.className).toContain('w-12');
  });

  it('applies sm icon size', () => {
    const { container } = render(<Spinner variant="icon" size="sm" />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute('size')).toBe('12');
  });

  it('applies md icon size', () => {
    const { container } = render(<Spinner variant="icon" size="md" />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute('size')).toBe('16');
  });

  it('applies lg icon size', () => {
    const { container } = render(<Spinner variant="icon" size="lg" />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute('size')).toBe('20');
  });

  it('merges custom className', () => {
    const { container } = render(<Spinner className="custom-class another-class" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('custom-class');
    expect(el.className).toContain('another-class');
  });

  it('has aria-hidden="true" for both variants', () => {
    const { container: ringContainer } = render(<Spinner variant="ring" />);
    expect(ringContainer.firstChild).toHaveAttribute('aria-hidden', 'true');

    const { container: iconContainer } = render(<Spinner variant="icon" />);
    expect(iconContainer.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('has displayName set', () => {
    expect((Spinner as unknown as { displayName: string }).displayName).toBe('Spinner');
  });
});