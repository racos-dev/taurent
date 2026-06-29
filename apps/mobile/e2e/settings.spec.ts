import { expect, test } from '@playwright/test';
import {
  clearRecordedCalls,
  gotoMobile,
  readLatestRecordedCall,
  readPreferences,
} from './helpers/mobile';

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

async function expectToggleThumbInsideTrack(locator: import('@playwright/test').Locator) {
  const bounds = await locator.evaluate((button) => {
    const track = button.querySelector('span');
    const thumb = track?.querySelector('span');
    if (!track || !thumb) {
      return null;
    }

    const trackBox = track.getBoundingClientRect();
    const thumbBox = thumb.getBoundingClientRect();
    return {
      trackLeft: trackBox.left,
      trackRight: trackBox.right,
      thumbLeft: thumbBox.left,
      thumbRight: thumbBox.right,
    };
  });

  expect(bounds).not.toBeNull();
  if (!bounds) {
    return;
  }

  expect(bounds.thumbLeft).toBeGreaterThanOrEqual(bounds.trackLeft);
  expect(bounds.thumbRight).toBeLessThanOrEqual(bounds.trackRight);
}

test.describe('mobile settings screen in shell', () => {
  test('renders settings screen inside the shell and keeps the tab bar visible', async ({ page }) => {
    await gotoMobile(page, {
      path: '/settings',
      appScenario: 'connected',
      scenario: 'empty',
    });

    await expect(page).toHaveURL(/\/settings/);

    // Screen-specific content rendered inside the shell content region.
    await expect(page.getByText('Settings').first()).toBeVisible();

    // The shared mobile `ScreenHeader` back button is the unified back
    // affordance introduced by T170 — every migrated mobile screen routes
    // through the same `arrow-left` button with `aria-label="Back"` and
    // the HEADER_ICON_BUTTON_SIZE_CLASSES.mobile (h-11 w-11) hit-area.
    const headerBack = page.getByRole('button', { name: 'Back' });
    await expect(headerBack).toBeVisible();
    await expectMinTouchTarget(headerBack);

    // Settings uses the mobile compact-width route body so it does not
    // render a desktop-wide accordion inside the phone viewport.
    const settingsHeader = page.locator('header').first();
    await expect(settingsHeader).toBeVisible();
    const headerGridClass = await settingsHeader
      .locator(':scope > div')
      .first()
      .getAttribute('class');
    expect(headerGridClass ?? '').toContain('max-w-lg');
    expect(headerGridClass ?? '').not.toContain('max-w-3xl');

    await expect(page.getByRole('button', { name: /Appearance/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Speed/ })).toBeVisible();

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

  test('opens manage servers without redirecting to torrents', async ({ page }) => {
    await gotoMobile(page, {
      path: '/settings',
      appScenario: 'connected',
      scenario: 'empty',
    });

    await page.getByRole('button', { name: /Manage Servers/ }).click();

    await expect(page).toHaveURL(/\/manage-servers/);
    await expect(page.getByRole('heading', { name: 'Servers', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /Mock Server/ })).toBeVisible();
    await expect(page).not.toHaveURL(/\/($|\?)/);
  });

  test('edits saved server connection info from manage servers', async ({ page }) => {
    await gotoMobile(page, {
      path: '/settings',
      appScenario: 'connected',
      scenario: 'empty',
    });

    await page.getByRole('button', { name: /Manage Servers/ }).click();
    await expect(page).toHaveURL(/\/manage-servers/);
    await clearRecordedCalls(page);

    await page.getByRole('button', { name: 'Edit server' }).click();
    await page.getByLabel('Server Name').fill('Edited Server');
    await page.getByLabel('Server URL').fill('https://edited.example:9443');
    await page.getByLabel('Username').fill('edited-user');
    await page.getByLabel('Password').fill('edited-password');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('button', { name: /Edited Server/ })).toBeVisible();
    await expect(page.getByText('https://edited.example:9443')).toBeVisible();
    await expect(page.getByText('edited-user')).toBeVisible();

    await expect
      .poll(async () => {
        const call = await readLatestRecordedCall(page, 'servers.updateServer');
        return call?.args[0] ?? null;
      })
      .toEqual({
        id: 'mock-server-id',
        name: 'Edited Server',
        url: 'https://edited.example:9443',
        username: 'edited-user',
        password: 'edited-password',
        remember_password: true,
      });
  });

  test('exposes exactly one BitTorrent section and exactly one Connection section', async ({ page }) => {
    await gotoMobile(page, {
      path: '/settings',
      appScenario: 'connected',
      scenario: 'empty',
    });

    // The T173 mobile settings rework collapses the legacy Seeding /
    // Privacy / Queue settings into a single BitTorrent section so the
    // same boolean and numeric controls are not duplicated. Lock the
    // structural invariant with two count assertions that look at the
    // rendered section headers rather than internal state.
    // `toHaveCount` auto-retries so the test is stable even when the
    // initial render lands after the navigation promise resolves.
    const bittorrentSections = page
      .locator('section')
      .filter({ has: page.getByRole('button', { name: /BitTorrent/ }) });
    await expect(bittorrentSections).toHaveCount(1);

    const connectionSections = page
      .locator('section')
      .filter({ has: page.getByRole('button', { name: /Connection/ }) });
    await expect(connectionSections).toHaveCount(1);

    // Both section entries must be visible to the user.
    await expect(
      page.getByRole('button', { name: /BitTorrent/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Connection/ }).first(),
    ).toBeVisible();
  });

  test('removes the danger zone section (Disconnect / Shutdown no longer shown in settings)', async ({ page }) => {
    await gotoMobile(page, {
      path: '/settings',
      appScenario: 'connected',
      scenario: 'empty',
    });

    // The danger zone was intentionally removed per T173. Disconnect and
    // Shutdown are no longer exposed from the settings screen. Verify
    // the section heading and both buttons are absent.
    const dangerZone = page
      .locator('section')
      .filter({ has: page.getByText('Danger Zone') });
    await expect(dangerZone).not.toBeVisible();

    await expect(
      page.getByRole('button', { name: /Disconnect/ }),
    ).not.toBeVisible();

    await expect(
      page.getByRole('button', { name: /Shutdown/ }),
    ).not.toBeVisible();
  });

  test('shows inline variant controls for manual appearance themes', async ({ page }) => {
    await gotoMobile(page, {
      path: '/settings',
      appScenario: 'connected',
      scenario: 'empty',
    });

    await page.getByRole('button', { name: /Appearance/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Appearance', level: 1 })).toBeVisible();

    await page.getByRole('button', { name: 'Manual' }).click();

    const variantGroups = page.getByRole('group', { name: 'Theme variant' });
    await expect(variantGroups).toHaveCount(3);
    await expect(page.getByText('Dark only').first()).toBeVisible();
    await expect(page.getByText('Variant')).not.toBeVisible();

    const solarizedVariant = variantGroups.first();
    await solarizedVariant.getByRole('button', { name: 'Dark' }).click();
    await expect(solarizedVariant.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('persists a boolean preference change through the mock bridge', async ({ page }) => {
    await gotoMobile(page, {
      path: '/settings',
      appScenario: 'connected',
      scenario: 'empty',
    });

    // Sanity-check the mock defaults before the interaction. The mock
    // fixture seeds `dht: true` so a regression that wires the toggle to
    // the wrong key (or to a non-existent one) surfaces immediately.
    const initial = await readPreferences(page);
    expect(initial?.dht).toBe(true);

    // Reset recorded calls so we only inspect the user-driven mutation
    // (the initial page load fires a number of unrelated bridge calls
    // for preferences, capabilities, and version probes).
    await clearRecordedCalls(page);

    // Open the focused BitTorrent editor before the DHT toggle becomes reachable.
    await page.getByRole('button', { name: /BitTorrent/ }).first().click();
    await expect(page.getByRole('heading', { name: 'BitTorrent', level: 1 })).toBeVisible();

    const dhtToggle = page
      .locator('button[aria-pressed]')
      .first();
    await expect(dhtToggle).toBeVisible();
    await expect(dhtToggle).toHaveAttribute('aria-pressed', 'true');
    await expectToggleThumbInsideTrack(dhtToggle);

    // Click stages the bit locally first. The server mock should not
    // change until the mobile Save All bar is submitted.
    await dhtToggle.click();

    await expect(dhtToggle).toHaveAttribute('aria-pressed', 'false');
    await expectToggleThumbInsideTrack(dhtToggle);
    await expect(page.getByText(/Unsaved/)).toBeVisible();
    expect((await readPreferences(page))?.dht).toBe(true);
    expect(await readLatestRecordedCall(page, 'application.setPreferences')).toBeNull();

    await page.getByRole('button', { name: 'Save All' }).click();

    await expect
      .poll(async () => (await readPreferences(page))?.dht)
      .toBe(false);

    await expect
      .poll(async () => {
        const call = await readLatestRecordedCall(page, 'application.setPreferences');
        return call?.args[0] ?? null;
      })
      .toEqual({ dht: false });
  });

  test('persists a numeric preference change through the number input modal', async ({ page }) => {
    await gotoMobile(page, {
      path: '/settings',
      appScenario: 'connected',
      scenario: 'empty',
    });

    // The mock fixture seeds `max_active_downloads: 3`. Pin the
    // starting value so a regression that wires the modal to the wrong
    // preference key is caught before the user interaction runs.
    const initial = await readPreferences(page);
    expect(initial?.max_active_downloads).toBe(3);

    await clearRecordedCalls(page);

    // Open the focused BitTorrent editor to expose the numeric rows.
    await page.getByRole('button', { name: /BitTorrent/ }).first().click();
    await expect(page.getByRole('heading', { name: 'BitTorrent', level: 1 })).toBeVisible();

    const maxDownloadsRow = page
      .getByRole('button', { name: /Maximum active downloads/ })
      .first();
    await expect(maxDownloadsRow).toBeVisible();
    await maxDownloadsRow.click();

    // The dialog uses the field's `mobileEditor.title` for its header —
    // assert the same title text on the dialog so we know the modal is
    // bound to the right preference.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Max downloads')).toBeVisible();

    // The number input is rendered by the shared NumberInput primitive
    // as `<input type="number">`. `fill()` clears the seeded value and
    // types the new one in a single interaction, which triggers the
    // modal's controlled onChange handler.
    const numberInput = dialog.locator('input[type="number"]');
    await expect(numberInput).toBeVisible();
    await numberInput.fill('5');

    // The default submit label is "Set" (see NumberInputModal). Use the
    // primary button inside the dialog so the assertion remains stable
    // if the cancel/submit order is later swapped.
    await dialog.getByRole('button', { name: /Set/ }).click();

    // The modal stages the value and keeps server state unchanged until
    // Save All is tapped.
    await expect(page.getByText(/Unsaved/)).toBeVisible();
    expect((await readPreferences(page))?.max_active_downloads).toBe(3);
    expect(await readLatestRecordedCall(page, 'application.setPreferences')).toBeNull();

    await page.getByRole('button', { name: 'Save All' }).click();

    // Verify the mock state and the recorded call both reflect the saved
    // value. `expect.poll` covers the mutation's async bridge hop.
    await expect
      .poll(async () => (await readPreferences(page))?.max_active_downloads)
      .toBe(5);

    await expect
      .poll(async () => {
        const call = await readLatestRecordedCall(page, 'application.setPreferences');
        return call?.args[0] ?? null;
      })
      .toEqual({ max_active_downloads: 5 });
  });

  test('persists speed preferences with the same raw values as desktop settings', async ({ page }) => {
    await gotoMobile(page, {
      path: '/settings',
      appScenario: 'connected',
      scenario: 'empty',
    });

    const initial = await readPreferences(page);
    expect(initial?.up_limit).toBe(-1);

    await clearRecordedCalls(page);

    await page.getByRole('button', { name: /Speed/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Speed', level: 1 })).toBeVisible();

    const uploadRow = page
      .getByRole('button', { name: /Upload/ })
      .first();
    await expect(uploadRow).toBeVisible();
    await uploadRow.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Upload')).toBeVisible();

    const numberInput = dialog.locator('input[type="number"]');
    await expect(numberInput).toBeVisible();
    await numberInput.fill('128');
    await dialog.getByRole('button', { name: /Set/ }).click();

    await expect(page.getByText(/Unsaved/)).toBeVisible();
    expect((await readPreferences(page))?.up_limit).toBe(-1);
    expect(await readLatestRecordedCall(page, 'application.setPreferences')).toBeNull();

    await page.getByRole('button', { name: 'Save All' }).click();

    await expect
      .poll(async () => (await readPreferences(page))?.up_limit)
      .toBe(128 * 1024);

    await expect
      .poll(async () => {
        const call = await readLatestRecordedCall(page, 'application.setPreferences');
        return call?.args[0] ?? null;
      })
      .toEqual({ up_limit: 128 * 1024 });
  });
});
