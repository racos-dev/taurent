/**
 * ScreenHeader component tests
 *
 * Focused coverage for the shared `ScreenHeader` contract introduced by
 * T170.1 (mobile variant upgrade) and exercised by T170.2 (mobile screen
 * migration). The tests assert the smallest set of behaviors that protect
 * against a reintroduction of split header behavior across the migrated
 * flows: subtitle rendering, trailing rightAction adoption, back-button
 * hit-area sizing, width mode, and the desktop branch regression guard.
 *
 * The test deliberately uses basic `expect` assertions plus DOM lookups
 * (matching the existing shared/primitive test pattern in this package)
 * instead of jest-dom matchers, so it runs under the same vitest setup
 * the surrounding shared-component tests rely on.
 */

import { describe, it, expect } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { ControlDensityProvider } from '../../../controlSizing';
import { ScreenHeader } from './ScreenHeader';

// Wrap ScreenHeader in a mobile density provider so the test exercises the
// same path the migrated mobile screens land on (HEADER_ICON_BUTTON_SIZE_CLASSES
// for `mobile`, not the desktop default).
function renderMobile(ui: Parameters<typeof render>[0]) {
  return render(<ControlDensityProvider value="mobile">{ui}</ControlDensityProvider>);
}

describe('ScreenHeader', () => {
  describe('mobile variant', () => {
    it('renders the title and subtitle when both are provided', () => {
      const { getByRole, getByText } = renderMobile(
        <ScreenHeader
          title="Add Torrent"
          subtitle="Paste a magnet link"
          variant="mobile"
          onBack={() => {}}
        />,
      );

      // getByRole/getByText throw when the element is missing, so a
      // successful lookup is itself the assertion.
      expect(getByRole('heading', { name: 'Add Torrent' })).toBeTruthy();
      expect(getByText('Paste a magnet link')).toBeTruthy();
    });

    it('omits the subtitle element when no subtitle is provided', () => {
      const { queryByText, container } = renderMobile(
        <ScreenHeader title="Filters" variant="mobile" onBack={() => {}} />,
      );

      // The title still renders...
      expect(queryByText('Filters')).toBeTruthy();
      // ...and no <p> subtitle leaks into the header DOM.
      const header = container.querySelector('header');
      expect(header).not.toBeNull();
      expect(header?.querySelectorAll('p')).toHaveLength(0);
    });

    it('renders a back button with the shared mobile hit-area size and "Back" accessible name', () => {
      const { getByRole } = renderMobile(
        <ScreenHeader title="Search" variant="mobile" onBack={() => {}} />,
      );

      const backButton = getByRole('button', { name: 'Back' });
      // HEADER_ICON_BUTTON_SIZE_CLASSES.mobile resolves to "h-11 w-11"; this
      // is the single hit-area token all migrated mobile back affordances
      // consume, so a regression here would silently shrink every back
      // button across the app.
      expect(backButton.className).toContain('h-11');
      expect(backButton.className).toContain('w-11');
    });

    it('invokes onBack when the back button is clicked', () => {
      const onBack = vi.fn();
      const { getByRole } = renderMobile(
        <ScreenHeader title="RSS Feeds" variant="mobile" onBack={onBack} />,
      );

      fireEvent.click(getByRole('button', { name: 'Back' }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('renders the supplied rightAction element when provided', () => {
      const { getByRole, container } = renderMobile(
        <ScreenHeader
          title="Filters"
          variant="mobile"
          onBack={() => {}}
          rightAction={
            <button type="button" aria-label="Clear filters">
              Clear
            </button>
          }
        />,
      );

      expect(getByRole('button', { name: 'Clear filters' })).toBeTruthy();
      // When rightAction is rendered, the centered title block must NOT
      // also emit a hidden trailing spacer — that would double the
      // right-side weight and break the title centering.
      const header = container.querySelector('header');
      expect(header).not.toBeNull();
      // The only aria-hidden spacer in the mobile grid is the empty
      // trailing slot rendered when rightAction is absent.
      expect(header?.querySelector('div[aria-hidden="true"]')).toBeNull();
    });

    it('emits a hidden trailing spacer for centering when onBack is present and rightAction is omitted', () => {
      const { container } = renderMobile(
        <ScreenHeader title="Add Torrent" variant="mobile" onBack={() => {}} />,
      );

      // The shared mobile grid uses 1fr / 2fr / 1fr columns; without a
      // rightAction the trailing slot renders an aria-hidden spacer sized
      // to match the back button so the title stays centered.
      const spacer = container.querySelector('div[aria-hidden="true"]');
      expect(spacer).not.toBeNull();
      // The mobile token resolves to h-11 w-11; mirror the back button so
      // the 1fr / 2fr / 1fr grid stays symmetric.
      expect(spacer?.className).toContain('h-11');
      expect(spacer?.className).toContain('w-11');
    });

    it('uses the compact width (max-w-lg) by default', () => {
      const { container } = renderMobile(
        <ScreenHeader title="Add Torrent" variant="mobile" onBack={() => {}} />,
      );

      const innerGrid = container.querySelector('header > div');
      expect(innerGrid).not.toBeNull();
      expect(innerGrid?.className).toContain('max-w-lg');
      expect(innerGrid?.className).not.toContain('max-w-3xl');
    });

    it('uses the wide width (max-w-3xl) when mobileWidth="wide"', () => {
      const { container } = renderMobile(
        <ScreenHeader
          title="Settings"
          variant="mobile"
          mobileWidth="wide"
          onBack={() => {}}
        />,
      );

      const innerGrid = container.querySelector('header > div');
      expect(innerGrid).not.toBeNull();
      expect(innerGrid?.className).toContain('max-w-3xl');
      expect(innerGrid?.className).not.toContain('max-w-lg');
    });

    it('applies the richer mobile sticky baseline (z-20, translucent bg, backdrop blur, tighter padding)', () => {
      const { container } = renderMobile(
        <ScreenHeader title="Search" variant="mobile" onBack={() => {}} />,
      );

      const header = container.querySelector('header');
      expect(header).not.toBeNull();
      // Sticky layering and stronger translucent background are the
      // baseline the migrated screens converge on; a regression here
      // would re-introduce the split header system T170 eliminated.
      expect(header?.className).toContain('sticky');
      expect(header?.className).toContain('top-0');
      expect(header?.className).toContain('z-20');
      expect(header?.className).toContain('bg-background/90');
      expect(header?.className).toContain('backdrop-blur-lg');
      expect(header?.className).toContain('py-2');
      expect(header?.className).toContain('touch-none');
      expect(header?.className).toContain('select-none');
    });

    it('hides the back button entirely when onBack is omitted', () => {
      const { queryByRole } = renderMobile(
        <ScreenHeader title="Home" variant="mobile" />,
      );

      // No back button + no rightAction means there are no buttons at
      // all in the mobile header (the trailing spacer is also gated on
      // either back or rightAction existing).
      expect(queryByRole('button')).toBeNull();
    });
  });

  describe('desktop variant (regression guard)', () => {
    it('renders the title with desktop styling and does not render the subtitle', () => {
      const { getByRole, queryByText, container } = render(
        <ScreenHeader
          title="My Screen"
          subtitle="Should be ignored on desktop"
          variant="desktop"
        />,
      );

      expect(getByRole('heading', { name: 'My Screen' })).toBeTruthy();
      // The desktop branch must not pick up the mobile subtitle — a
      // regression here would surface untranslated mobile copy in the
      // existing desktop consumers.
      expect(queryByText('Should be ignored on desktop')).toBeNull();

      const header = container.querySelector('header');
      expect(header).not.toBeNull();
      // Desktop branch stays on the existing compact z-10 + solid bg path.
      expect(header?.className).toContain('z-10');
      expect(header?.className).toContain('bg-surface');
      expect(header?.className).not.toContain('z-20');
    });

    it('renders the desktop back button and wires onBack', () => {
      const onBack = vi.fn();
      const { container } = render(
        <ScreenHeader title="My Screen" variant="desktop" onBack={onBack} />,
      );

      // The desktop back button stays on its existing compact visual
      // (T170 explicitly leaves the desktop branch alone), so this
      // regression guard only asserts that the button is wired and the
      // click callback still fires — not the specific className shape.
      const backButton = container.querySelector('header button');
      expect(backButton).not.toBeNull();
      if (backButton) {
        fireEvent.click(backButton);
      }
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  it('has displayName set for React DevTools clarity', () => {
    expect(
      (ScreenHeader as unknown as { displayName: string }).displayName,
    ).toBe('ScreenHeader');
  });
});
