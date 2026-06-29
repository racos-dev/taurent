import { expect, test } from '@playwright/test';
import { gotoMobile } from './helpers/mobile';

// Tab labels rendered by MobileShell's bottom tab bar. The tab bar must
// remain visible regardless of which shell-backed tab is active.
const TAB_LABELS = ['Torrents', 'Search', 'RSS', 'Settings'] as const;

// Minimum interactive hit area introduced by the T169 mobile control-density
// pass. The mobile density provider opts shared primitives into this target
// (via `min-h-11` / `h-11 w-11` helper classes), so regression coverage
// asserts the new baseline rather than the previous compact dimensions.
const MOBILE_MIN_TOUCH_TARGET_PX = 44;

async function expectMinTouchTarget(
  locator: import('@playwright/test').Locator,
  minSize: number = MOBILE_MIN_TOUCH_TARGET_PX,
) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }
  expect(box.height).toBeGreaterThanOrEqual(minSize);
  expect(box.width).toBeGreaterThanOrEqual(minSize);
}

test.describe('mobile search screen in shell', () => {
  test('renders search screen inside the shell and keeps the tab bar visible', async ({ page }) => {
    await gotoMobile(page, {
      path: '/search',
      appScenario: 'connected',
      scenario: 'empty',
    });

    await expect(page).toHaveURL(/\/search/);

    // Screen-specific content rendered inside the shell content region.
    await expect(page.getByText('Search').first()).toBeVisible();

    // The shared mobile `ScreenHeader` subtitle slot (T170.1) is the only
    // place the Search screen exposes its idle helper text. Asserting the
    // exact subtitle copy here locks in the new shared subtitle behavior
    // and catches a regression to title-only mobile headers on this flow.
    await expect(
      page.getByText('Find torrents', { exact: true }),
    ).toBeVisible();

    // The shared mobile `ScreenHeader` back button is the unified back
    // affordance introduced by T170 — every migrated mobile screen routes
    // through the same `arrow-left` button with `aria-label="Back"` and
    // the HEADER_ICON_BUTTON_SIZE_CLASSES.mobile (h-11 w-11) hit-area.
    const headerBack = page.getByRole('button', { name: 'Back' });
    await expect(headerBack).toBeVisible();
    await expectMinTouchTarget(headerBack);

    // Persistent tab bar still anchored to the shell. Each tab item is
    // expected to reach the new 44px touch target baseline.
    const tabBar = page.getByRole('navigation');
    await expect(tabBar).toBeVisible();
    for (const label of TAB_LABELS) {
      const link = tabBar.getByRole('link', { name: label });
      await expect(link).toBeVisible();
      await expectMinTouchTarget(link);
    }
  });
});
