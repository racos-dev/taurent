import { expect, test } from '@playwright/test';
import {
  failNextMutation,
  gotoMobile,
  readPendingMutationFailure,
  readRecordedCalls,
} from './helpers/mobile';

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

test.describe('mobile add torrent flows', () => {
  test('submits a magnet from /add-torrent route', async ({ page }) => {
    await gotoMobile(page, {
      path: '/add-torrent',
      appScenario: 'connected',
      scenario: 'empty',
    });

    // Verify the add torrent screen renders
    await expect(page.getByText('Add Torrent').first()).toBeVisible();
    // The shared mobile `ScreenHeader` back button is the unified back
    // affordance introduced by T170 — every migrated mobile screen routes
    // through the same `arrow-left` button with `aria-label="Back"` and
    // the HEADER_ICON_BUTTON_SIZE_CLASSES.mobile (h-11 w-11) hit-area.
    const headerBack = page.getByRole('button', { name: 'Back' });
    await expect(headerBack).toBeVisible();
    await expectMinTouchTarget(headerBack);

    // The mobile `ScreenHeader` subtitle slot (T170.1) is the only place
    // AddTorrent exposes its mode-specific helper text. Asserting the
    // magnet-mode copy here locks in the new shared subtitle behavior so
    // a regression to title-only mobile headers is caught immediately.
    await expect(page.getByText('Paste a magnet link')).toBeVisible();

    const magnetInput = page.getByPlaceholder('magnet:?xt=urn:btih:...');
    await expect(magnetInput).toBeVisible();
    // The shared `Input` primitive consumes the mobile density path and
    // renders at `h-11` so the field reaches the comfortable touch-target
    // baseline.
    await expectMinTouchTarget(magnetInput);

    const magnet = 'magnet:?xt=urn:btih:0123456789ABCDEF0123456789ABCDEF01234567';
    await magnetInput.fill(magnet);
    await page.getByPlaceholder('/downloads').fill('/data/watch');

    // Click submit and verify no validation error appears
    const submitButton = page.getByRole('button', { name: 'Add Torrent', exact: true });
    await expect(submitButton).toBeVisible();
    // Submit action uses the shared `Button` primitive (size="medium" by
    // default through DialogActions); the mobile density path applies
    // `min-h-11 py-2` so the primary action reaches the touch target.
    await expectMinTouchTarget(submitButton);
    await submitButton.click();

    await expect(page).toHaveURL('about:blank');

    // If validation failed, an error would be visible
    const errorVisible = await page.getByText('Invalid URL or magnet format').isVisible().catch(() => false);
    expect(errorVisible).toBe(false);
  });

  test('renders the file-mode subtitle in the shared mobile header', async ({ page }) => {
    await gotoMobile(page, {
      path: '/add-torrent?mode=file',
      appScenario: 'connected',
      scenario: 'empty',
    });

    // The title stays stable across mode changes (still rendered by the
    // shared mobile `ScreenHeader`); only the subtitle copy flips, so the
    // file-mode subtitle landing in the shared <p> subtitle slot proves
    // the route-shell migration to the shared subtitle contract survived
    // end-to-end. `exact: true` disambiguates from the body button label
    // "Select Torrent Files" (different capitalization, separate slot).
    await expect(page.getByText('Add Torrent').first()).toBeVisible();
    await expect(
      page.getByText('Select torrent files', { exact: true }),
    ).toBeVisible();
  });

  test('validates invalid magnet input', async ({ page }) => {
    await gotoMobile(page, {
      path: '/add-torrent',
      appScenario: 'connected',
      scenario: 'empty',
    });

    await page.getByPlaceholder('magnet:?xt=urn:btih:...').fill('not-a-magnet');
    await page.getByRole('button', { name: 'Add Torrent', exact: true }).click();

    await expect(page.getByText('Invalid URL or magnet format')).toBeVisible();

    const calls = await readRecordedCalls(page);
    expect(calls.some((call) => call.name === 'torrents.addTorrent')).toBe(false);
  });

  test('keeps the form open when add torrent fails', async ({ page }) => {
    await gotoMobile(page, {
      path: '/add-torrent',
      appScenario: 'connected',
      scenario: 'empty',
    });

    const magnet = 'magnet:?xt=urn:btih:89ABCDEF0123456789ABCDEF0123456789ABCDEF';
    await failNextMutation(page, 'torrents.addTorrent', 'Bridge add failed');
    await page.getByPlaceholder('magnet:?xt=urn:btih:...').fill(magnet);
    await page.getByPlaceholder('/downloads').fill('/downloads/fail-case');

    await page.getByRole('button', { name: 'Add Torrent', exact: true }).click();

    await expect(page).toHaveURL(/\/add-torrent\?/);
    await expect(page.getByPlaceholder('/downloads')).toBeVisible();
    await expect(page.getByPlaceholder('magnet:?xt=urn:btih:...')).toHaveValue(magnet);
    await expect(page.getByRole('button', { name: 'Add Torrent', exact: true })).toBeEnabled();

    const calls = await readRecordedCalls(page);
    expect(calls.filter((call) => call.name === 'torrents.addTorrent')).toHaveLength(1);

    const pendingFailure = await readPendingMutationFailure(page);
    expect(pendingFailure).toBeNull();
  });
});
