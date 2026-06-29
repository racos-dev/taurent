import { expect, test } from '@playwright/test';
import { gotoMobile, readRecordedCalls, waitForHomeReady } from './helpers/mobile';

// Tab labels rendered by MobileShell's bottom tab bar. Bootstrap flows that
// land on a protected route should still expose the shell tab bar so users
// can navigate away from any blocked/empty home state.
const TAB_LABELS = ['Torrents', 'Search', 'RSS', 'Settings'] as const;

async function expectShellTabBarPresent(page: import('@playwright/test').Page) {
  const tabBar = page.getByRole('navigation');
  await expect(tabBar).toBeVisible();
  for (const label of TAB_LABELS) {
    await expect(tabBar.getByRole('link', { name: label })).toBeVisible();
  }
}

test.describe('mobile bootstrap flows', () => {
  test('redirects to /add-server when no saved servers exist', async ({ page }) => {
    await gotoMobile(page, { appScenario: 'no-saved-servers' });

    await expect(page).toHaveURL(/\/add-server$/);
    await expect(page.getByRole('heading', { name: 'Add Server' })).toBeVisible();

    const calls = await readRecordedCalls(page);
    expect(calls.some((call) => call.name === 'sessionConnectById')).toBe(false);
  });

  test('auto-connects with the saved active server on protected routes', async ({ page }) => {
    await gotoMobile(page, { appScenario: 'saved-server-disconnected', scenario: 'small-100' });

    await waitForHomeReady(page);
    await expect(page.getByText('Torrent 1').first()).toBeVisible();

    const calls = await readRecordedCalls(page);
    expect(calls.some((call) => call.name === 'sessionConnectById')).toBe(true);
    expect(calls.some((call) => call.name === 'servers.getActiveServer')).toBe(true);

    // The protected home route still renders the shell tab bar so the user
    // can navigate between destinations after the auto-connect completes.
    await expectShellTabBarPresent(page);
  });

  test('redirects to /servers with an error when saved server auto-connect fails', async ({ page }) => {
    await gotoMobile(page, { appScenario: 'saved-server-unavailable' });

    await expect(page).toHaveURL(/\/servers$/);
    await expect(page.getByRole('heading', { name: 'Servers' })).toBeVisible();
    await expect(page.getByText('Could not connect to the server. Try again.')).toBeVisible();

    const calls = await readRecordedCalls(page);
    expect(calls.filter((call) => call.name === 'sessionConnectById')).toHaveLength(1);
  });

  test('shows the credential warning banner when a saved server is missing credentials', async ({ page }) => {
    await gotoMobile(page, { appScenario: 'saved-server-credential-missing' });

    await expect(page).toHaveURL(/\/servers$/);
    await expect(page.getByRole('heading', { name: 'Servers' })).toBeVisible();
    await expect(page.getByText('Saved password missing. Enter it again to reconnect.').first()).toBeVisible();

    const calls = await readRecordedCalls(page);
    expect(calls.filter((call) => call.name === 'sessionConnectById')).toHaveLength(1);
    expect(calls.some((call) => call.name === 'servers.getActiveServer')).toBe(true);
  });

  test('keeps connected sessions on the main route', async ({ page }) => {
    await gotoMobile(page, { appScenario: 'connected', scenario: 'empty' });

    await waitForHomeReady(page);
    await expect(page.getByText(/no torrents yet/i)).toBeVisible();

    const calls = await readRecordedCalls(page);
    expect(calls.some((call) => call.name === 'sessionConnectById')).toBe(false);

    // The connected home route still renders the shell tab bar; the empty
    // state plus tab bar is the post-bootstrap resting view.
    await expectShellTabBarPresent(page);
  });
});
