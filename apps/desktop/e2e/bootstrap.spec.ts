import { expect, test } from '@playwright/test';
import { gotoDesktop, readRecordedCalls, waitForHomeReady } from './helpers/desktop';

test.describe('desktop bootstrap flows', () => {
  test('redirects to add-server when no saved servers exist', async ({ page }) => {
    await gotoDesktop(page, { appScenario: 'no-saved-servers' });

    await expect(page).toHaveURL(/\/add-server$/);
    await expect(page.getByRole('heading', { name: 'Add New Server' })).toBeVisible();

    const calls = await readRecordedCalls(page);
    expect(calls.some((call) => call.name === 'sessionConnectById')).toBe(false);
  });

  test('auto-connects with the saved active server on protected routes', async ({ page }) => {
    await gotoDesktop(page, { appScenario: 'saved-server-disconnected', scenario: 'small-100' });

    await waitForHomeReady(page);
    await expect(page.getByText('Torrent 1')).toBeVisible();

    const calls = await readRecordedCalls(page);
    expect(calls.some((call) => call.name === 'sessionConnectById')).toBe(true);
    expect(calls.some((call) => call.name === 'servers.getActiveServer')).toBe(true);
  });

  test('redirects to login with an error when saved server auto-connect fails', async ({ page }) => {
    await gotoDesktop(page, { appScenario: 'saved-server-unavailable' });

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Connect to Server' })).toBeVisible();
    await expect(page.getByText('Could not connect to the server. Try again.')).toBeVisible();

    const calls = await readRecordedCalls(page);
    expect(calls.filter((call) => call.name === 'sessionConnectById')).toHaveLength(1);
  });

  test('shows the credential warning banner when a saved server is missing credentials', async ({ page }) => {
    await gotoDesktop(page, { appScenario: 'saved-server-credential-missing' });

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Connect to Server' })).toBeVisible();
    const credentialBanner = page
      .getByRole('button', { name: 'Dismiss' })
      .locator('xpath=ancestor::div[contains(@class, "bg-warning-20")][1]');
    await expect(credentialBanner.getByText('Saved password missing. Enter it again to reconnect.')).toBeVisible();

    const calls = await readRecordedCalls(page);
    expect(calls.filter((call) => call.name === 'sessionConnectById')).toHaveLength(1);
    expect(calls.some((call) => call.name === 'servers.getActiveServer')).toBe(true);
  });

  test('keeps connected sessions on the main route', async ({ page }) => {
    await gotoDesktop(page, { appScenario: 'connected', scenario: 'empty' });

    await waitForHomeReady(page);
    await expect(page.getByText(/no torrents/i)).toBeVisible();

    const calls = await readRecordedCalls(page);
    expect(calls.some((call) => call.name === 'sessionConnectById')).toBe(false);
  });
});
