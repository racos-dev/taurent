/**
 * SkeletonBlock component tests
 *
 * Tests:
 * - background prop renders correct class
 * - radius 'sm' maps to rounded-sm
 * - radius 'md' maps to rounded-md (was previously rounded-sm — bugfix)
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SkeletonBlock } from './SkeletonBlock';

describe('SkeletonBlock', () => {
  it('renders with default background bg-surface', () => {
    const { container } = render(<SkeletonBlock />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('bg-surface');
    expect(el.className).toContain('animate-pulse');
  });

  it('renders with custom background class', () => {
    const { container } = render(<SkeletonBlock background="bg-surface-interactive" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('bg-surface-interactive');
    // default bg-surface should not be present when custom background is provided
    expect(el.className).not.toContain('bg-surface ');
  });

  it('radius sm maps to rounded-sm', () => {
    const { container } = render(<SkeletonBlock radius="sm" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('rounded-sm');
    expect(el.className).not.toContain('rounded-md');
  });

  it('radius md maps to rounded-md (bugfix: was previously rounded-sm)', () => {
    const { container } = render(<SkeletonBlock radius="md" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('rounded-md');
    expect(el.className).not.toContain('rounded-sm');
  });

  it('applies width and height via style', () => {
    const { container } = render(<SkeletonBlock width={120} height={40} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe(120);
    expect(el.style.height).toBe(40);
  });

  it('defaults width to 100% and height to 1rem', () => {
    const { container } = render(<SkeletonBlock />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('100%');
    expect(el.style.height).toBe('1rem');
  });

  it('merges custom className', () => {
    const { container } = render(<SkeletonBlock className="custom-class" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('custom-class');
  });

  it('radius none maps to rounded-none', () => {
    const { container } = render(<SkeletonBlock radius="none" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('rounded-none');
  });

  it('radius lg maps to rounded-md', () => {
    const { container } = render(<SkeletonBlock radius="lg" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('rounded-md');
  });

  it('radius full maps to rounded-full', () => {
    const { container } = render(<SkeletonBlock radius="full" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('rounded-full');
  });
});
