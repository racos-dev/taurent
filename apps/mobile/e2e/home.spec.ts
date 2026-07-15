import { expect, test } from '@playwright/test';
import { gotoMobile, waitForHomeReady } from './helpers/mobile';

// Persistent shell tab labels — rendered by MobileShell's bottom tab bar
// and reused across every assertion to prove the tab bar survives shell
// layout changes and in-shell route navigation.
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

async function expectTabBarVisible(page: import('@playwright/test').Page) {
  const tabBar = page.getByRole('navigation');
  await expect(tabBar).toBeVisible();
  for (const label of TAB_LABELS) {
    const link = tabBar.getByRole('link', { name: label });
    await expect(link).toBeVisible();
    // Mobile tab items consume the shared `TAB_BAR_PILL_ITEM_CLASSES.mobile`
    // class which now enforces `min-h-11`; the regression coverage ensures
    // the larger touch target actually lands in the rendered tab items.
    await expectMinTouchTarget(link);
  }
}

async function expectFabAboveTabBar(page: import('@playwright/test').Page) {
  const tabBar = page.getByRole('navigation');
  const fab = page.locator('button[title="Add Torrent"]');
  await expect(fab).toBeVisible();
  // The FAB itself is a 48px (h-12 w-12) circle — comfortably above the
  // 44px touch-target baseline. Asserting both axes keeps regression
  // coverage honest if the FAB sizing is reduced in the future.
  await expectMinTouchTarget(fab);

  const [tabBarBox, fabBox] = await Promise.all([
    tabBar.boundingBox(),
    fab.boundingBox(),
  ]);

  expect(tabBarBox).not.toBeNull();
  expect(fabBox).not.toBeNull();

  if (!tabBarBox || !fabBox) {
    return;
  }

  expect(fabBox.y + fabBox.height).toBeLessThanOrEqual(tabBarBox.y);
}

test.describe('mobile home tab in shell', () => {
  test('renders home screen inside the shell and keeps the tab bar visible', async ({ page }) => {
    await gotoMobile(page, {
      path: '/',
      appScenario: 'connected',
      scenario: 'empty',
    });

    await waitForHomeReady(page);
    await expect(page).toHaveURL(/\/($|\?)/);

    // Home-screen content rendered inside the shell content region.
    await expect(page.getByText('No torrents yet')).toBeVisible();
    // Empty-state action button (distinct from the floating "Add Torrent" FAB).
    const emptyStateAddButton = page.getByRole('button', {
      name: 'Add torrent',
      exact: true,
    });
    await expect(emptyStateAddButton).toBeVisible();
    // Empty-state "Add torrent" button consumes the shared `Button` primitive
    // with size="sm"; the mobile density path applies `min-h-11` so the
    // call-to-action reaches the comfortable touch-target baseline.
    await expectMinTouchTarget(emptyStateAddButton);

    // Home-header icon buttons (Search / Sort / Filters) all
    // consume the local `IconButton` that now resolves to
    // `HEADER_ICON_BUTTON_SIZE_CLASSES.mobile` (h-11 w-11). The Search
    // entry is checked here as a representative header touch target; the
    // other header icons share the same implementation.
    const homeSearchButton = page.getByRole('button', { name: 'Search' });
    await expect(homeSearchButton).toBeVisible();
    await expectMinTouchTarget(homeSearchButton);

    // Persistent tab bar still anchored to the shell.
    await expectTabBarVisible(page);
    await expectFabAboveTabBar(page);
  });

  test('tab bar persists across in-shell navigation between all four tabs', async ({ page }) => {
    await gotoMobile(page, {
      path: '/',
      appScenario: 'connected',
      scenario: 'empty',
    });

    await waitForHomeReady(page);
    await expectTabBarVisible(page);

    // Move to the Search tab via the shell tab bar.
    await page.getByRole('navigation').getByRole('link', { name: 'Search' }).click();
    await expect(page).toHaveURL(/\/search/);
    await expect(page.getByText('Find torrents', { exact: true })).toBeVisible();
    await expectTabBarVisible(page);

    // Move to the RSS tab.
    await page.getByRole('navigation').getByRole('link', { name: 'RSS' }).click();
    await expect(page).toHaveURL(/\/rss/);
    await expect(page.getByText('RSS Feeds').first()).toBeVisible();
    await expectTabBarVisible(page);

    // Move to the Settings tab.
    await page.getByRole('navigation').getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByText('Settings').first()).toBeVisible();
    await expectTabBarVisible(page);

    // Return to the home (Torrents) tab.
    await page.getByRole('navigation').getByRole('link', { name: 'Torrents' }).click();
    await expect(page).toHaveURL(/\/($|\?)/);
    await expect(page.getByText('No torrents yet')).toBeVisible();
    await expectTabBarVisible(page);
  });
});
