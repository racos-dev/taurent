import { expect, test } from '@playwright/test';

import { gotoDesktop, readRecordedCalls, waitForHomeReady } from './helpers/desktop';

test.describe('desktop updater', () => {
  test('startup update prompt appears once', async ({ page }) => {
    await gotoDesktop(page, {
      scenario: 'empty',
      appScenario: 'connected',
      searchParams: { mockUpdate: 'available' },
    });
    await waitForHomeReady(page);

    await expect(page.getByText('Taurent v1.1.0 is available')).toHaveCount(1);

    const calls = await readRecordedCalls(page);
    expect(calls.filter((call) => call.name === 'checkForUpdate')).toHaveLength(1);
  });

  test('Later dismisses the startup prompt without installing', async ({ page }) => {
    await gotoDesktop(page, {
      scenario: 'empty',
      appScenario: 'connected',
      searchParams: { mockUpdate: 'available' },
    });
    await waitForHomeReady(page);

    await page.getByRole('button', { name: 'Later', exact: true }).click();
    await expect(page.getByText('Taurent v1.1.0 is available')).not.toBeVisible();

    const calls = await readRecordedCalls(page);
    expect(calls.some((call) => call.name === 'downloadAndInstallUpdate')).toBe(false);
  });

  test('manual check works from About settings', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/settings-window?section=desktop-about',
      scenario: 'empty',
      appScenario: 'connected',
    });
    await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();

    await page.evaluate(() => {
      window.__TAURENT_AUTOMATION__?.setUpdateAvailable({ version: '1.2.0' });
      window.__TAURENT_AUTOMATION__?.clearRecordedCalls();
    });

    await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
    await expect(page.getByText('Taurent v1.2.0 is available.')).toBeVisible();

    const calls = await readRecordedCalls(page);
    expect(calls.map((call) => call.name)).toContain('checkForUpdate');
  });

  test('install flow shows progress and relaunch-ready state', async ({ page }) => {
    await gotoDesktop(page, {
      scenario: 'empty',
      appScenario: 'connected',
      searchParams: { mockUpdate: 'available' },
    });
    await waitForHomeReady(page);

    await page.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(page.getByText('Update installed')).toBeVisible();
    await expect(page.getByText('Relaunch Taurent to finish updating.')).toBeVisible();

    await page.getByRole('button', { name: 'Relaunch', exact: true }).click();

    const callNames = (await readRecordedCalls(page)).map((call) => call.name);
    expect(callNames).toContain('checkForUpdate');
    expect(callNames).toContain('downloadAndInstallUpdate');
    expect(callNames).toContain('relaunchApp');
  });
});
