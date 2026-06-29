import { expect, test } from '@playwright/test';
import {
  failNextMutation,
  gotoDesktop,
  readLatestRecordedCall,
  readMockWindowVisibility,
  readRecordedCalls,
  readSyncCallCount,
  requestMockWindowClose,
  waitForMockWebview,
} from './helpers/desktop';

const UPNP_LABEL = 'Use UPnP / NAT-PMP port forwarding from my router';

async function gotoSettingsServers(
  page: import('@playwright/test').Page,
  appScenario:
    | 'connected'
    | 'no-saved-servers'
    | 'no-saved-servers-failure'
    | 'saved-server-disconnected'
    | 'saved-server-unavailable'
    | 'saved-server-credential-missing'
    | 'saved-server-credential-unavailable' = 'connected',
) {
  await gotoDesktop(page, {
    path: '/settings-window?section=desktop-servers',
    appScenario,
    scenario: 'empty',
  });

  await expect(page.getByRole('heading', { name: 'Servers', exact: true }).first()).toBeVisible();
  await expect(page.getByText('Saved Server List')).toBeVisible();
}

function serverCard(page: import('@playwright/test').Page, name: string) {
  const nameText = page.getByText(name, { exact: true });
  return nameText.locator('xpath=ancestor::div[contains(@class,"group")][1]');
}

async function openAddServerForm(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Add New Server' }).click();
  await expect(page.getByRole('heading', { name: 'Add New Server' })).toBeVisible();
}

function addServerForm(page: import('@playwright/test').Page) {
  return page
    .getByRole('heading', { name: 'Add New Server' })
    .locator('xpath=ancestor::div[.//input[@placeholder="My Home Server"]][1]');
}

async function fillAddServerForm(
  page: import('@playwright/test').Page,
  values: { name: string; url: string; username: string; password: string },
) {
  const form = addServerForm(page);
  const inputs = form.locator('input');
  await inputs.nth(0).fill(values.name);
  await inputs.nth(1).fill(values.url);
  await inputs.nth(2).fill(values.username);
  await form.locator('input[type="password"]').fill(values.password);
}

async function toggleRemoteCheckbox(page: import('@playwright/test').Page, label: string) {
  const labelText = page.getByText(label, { exact: true });
  const row = labelText.locator(
    'xpath=ancestor::div[contains(@class,"flex") and contains(@class,"gap-3")][1]',
  );

  await expect(row).toBeVisible();

  const toggleButton = row.locator('xpath=./div[1]//button[1]');
  await expect(toggleButton).toBeVisible();
  await expect(toggleButton).toBeEnabled();
  await toggleButton.click();
}

test.describe('desktop utility windows', () => {
  test('renders settings for a connected session', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/settings-window',
      appScenario: 'connected',
      scenario: 'empty',
    });

    await expect(page.getByRole('heading', { name: 'App Behavior' })).toBeVisible();

    await expect.poll(async () => {
      const calls = await readRecordedCalls(page);
      return calls.some((call) => call.name === 'application.getPreferences');
    }).toBe(true);
  });

  test('shows a graceful disconnected fallback in statistics window', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/statistics-window',
      appScenario: 'saved-server-disconnected',
      scenario: 'empty',
    });

    await expect(page.getByText('Not connected')).toBeVisible();
    await expect(page.getByText('Connect to a qBittorrent server to view statistics.')).toBeVisible();

    const syncCalls = await readSyncCallCount(page);
    expect(syncCalls).toBe(0);
  });

  test('keeps dirty settings open when close confirm returns stay', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/settings-window?section=remote-connection',
      appScenario: 'connected',
      scenario: 'empty',
    });

    await toggleRemoteCheckbox(page, UPNP_LABEL);
    await expect(page.getByText('Unsaved changes')).toBeVisible();

    await expect.poll(() => requestMockWindowClose(page)).toBe(false);
    await expect(page.getByText('Unsaved Changes', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Stay', exact: true }).click();

    await expect.poll(() => readMockWindowVisibility(page)).toBe(true);
    await expect(page.getByText('Unsaved changes')).toBeVisible();

    const calls = await readRecordedCalls(page);
    expect(calls.some((call) => call.name === 'application.setPreferences')).toBe(false);
  });

  test('discards dirty settings and closes when close confirm returns discard', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/settings-window?section=remote-connection',
      appScenario: 'connected',
      scenario: 'empty',
    });

    await toggleRemoteCheckbox(page, UPNP_LABEL);
    await expect(page.getByText('Unsaved changes')).toBeVisible();

    await expect.poll(() => requestMockWindowClose(page)).toBe(false);
    await expect(page.getByText('Unsaved Changes', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Discard & Close', exact: true }).click();

    await expect.poll(() => readMockWindowVisibility(page)).toBe(false);

    const calls = await readRecordedCalls(page);
    expect(calls.some((call) => call.name === 'application.setPreferences')).toBe(false);
  });

  test('saves dirty settings and closes when close confirm returns save', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/settings-window?section=remote-connection',
      appScenario: 'connected',
      scenario: 'empty',
    });

    await toggleRemoteCheckbox(page, UPNP_LABEL);
    await expect(page.getByText('Unsaved changes')).toBeVisible();

    await expect.poll(() => requestMockWindowClose(page)).toBe(false);
    await expect(page.getByText('Unsaved Changes', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save & Close', exact: true }).click();

    await expect.poll(() => readMockWindowVisibility(page)).toBe(false);

    const calls = await readRecordedCalls(page);
    expect(calls.some((call) => call.name === 'application.setPreferences')).toBe(true);
  });

  test('renders the saved servers section for a connected session', async ({ page }) => {
    await gotoSettingsServers(page, 'connected');

    await expect(page.getByText('Mock Server', { exact: true })).toBeVisible();
    await expect(page.getByText('http://localhost:8080', { exact: true })).toBeVisible();
    await expect(page.getByText('Active', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add New Server' })).toBeVisible();

    await expect.poll(async () => {
      const calls = await readRecordedCalls(page);
      return {
        listed: calls.some((call) => call.name === 'servers.listServers'),
        active: calls.some((call) => call.name === 'servers.getActiveServer'),
      };
    }).toEqual({ listed: true, active: true });
  });

  test('adds a saved server after a successful connection test', async ({ page }) => {
    await gotoSettingsServers(page, 'connected');
    await openAddServerForm(page);

    await fillAddServerForm(page, {
      name: 'Office Server',
      url: 'http://office.example:8080',
      username: 'operator',
      password: 'secret',
    });

    await addServerForm(page).getByRole('button', { name: 'Test Connection', exact: true }).click();
    await expect(page.getByText('Connection successful!')).toBeVisible();

    let call = await readLatestRecordedCall(page, 'servers.probeServerScheme');
    expect(call?.args).toEqual([
      'http://office.example:8080',
      'operator',
      'secret',
    ]);

    await addServerForm(page).getByRole('button', { name: 'Add Server', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Add New Server' })).toHaveCount(0);
    await expect(page.getByText('Office Server', { exact: true })).toBeVisible();

    call = await readLatestRecordedCall(page, 'servers.addServer');
    expect(call?.args[0]).toEqual(expect.objectContaining({
      name: 'Office Server',
      url: 'http://office.example:8080',
      username: 'operator',
      password: 'secret',
    }));
  });

  test('shows connection failure for a new server', async ({ page }) => {
    await gotoSettingsServers(page, 'no-saved-servers-failure');

    await openAddServerForm(page);
    await fillAddServerForm(page, {
      name: 'Broken Server',
      url: 'http://offline.example:8080',
      username: 'operator',
      password: 'bad-secret',
    });

    await addServerForm(page).getByRole('button', { name: 'Test Connection', exact: true }).click();
    await expect(page.getByText('Unable to reach server')).toBeVisible();
    await expect(addServerForm(page).getByRole('button', { name: 'Add Server', exact: true })).toBeDisabled();

    const call = await readLatestRecordedCall(page, 'servers.probeServerScheme');
    expect(call?.args).toEqual([
      'http://offline.example:8080',
      'operator',
      'bad-secret',
    ]);
  });

  test('shows connection failure for a saved server', async ({ page }) => {
    await gotoSettingsServers(page, 'saved-server-unavailable');

    await serverCard(page, 'Mock Server').getByTitle('Test connection').click();
    await expect(page.getByText('Could not connect to the server. Try again.')).toBeVisible();

    const call = await readLatestRecordedCall(page, 'servers.testSavedServerConnection');
    expect(call?.args).toEqual(['mock-server-id']);
  });

  test('shows inline credential health for saved servers with unavailable credentials', async ({ page }) => {
    await gotoSettingsServers(page, 'saved-server-credential-unavailable');

    const card = serverCard(page, 'Credential Unavailable Server');
    await expect(card.getByText('http://localhost:8080', { exact: true })).toBeVisible();
    await expect(card.getByText('Unavailable', { exact: true })).toBeVisible();

    await expect.poll(async () => {
      const calls = await readRecordedCalls(page);
      return {
        listed: calls.some((call) => call.name === 'servers.listServers'),
        active: calls.some((call) => call.name === 'servers.getActiveServer'),
      };
    }).toEqual({ listed: true, active: true });
  });

  test('edits an existing saved server', async ({ page }) => {
    await gotoSettingsServers(page, 'connected');

    const card = serverCard(page, 'Mock Server');
    await card.getByTitle('Edit server').click();
    const editForm = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Edit Server' }) });
    await expect(editForm.getByRole('heading', { name: 'Edit Server' })).toBeVisible();

    await editForm.locator('input').nth(0).fill('Mock Server Updated');
    await editForm.locator('input').nth(1).fill('http://updated.example:9090');
    await editForm.locator('input').nth(2).fill('updated-user');
    await editForm.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByText('Mock Server Updated', { exact: true })).toBeVisible();
    await expect(page.getByText('http://updated.example:9090', { exact: true })).toBeVisible();

    const call = await readLatestRecordedCall(page, 'servers.updateServer');
    expect(call?.args[0]).toEqual({
      id: 'mock-server-id',
      name: 'Mock Server Updated',
      url: 'http://updated.example:9090',
      username: 'updated-user',
    });
  });

  test('shows visible feedback and preserves active server on failed atomic switch', async ({ page }) => {
    // Navigate first so window.__TAURENT_AUTOMATION__ is installed, then inject failure
    await gotoSettingsServers(page, 'connected');

    // Inject a mutation failure so the atomic switch rejects with a clear error
    await failNextMutation(page, 'sessionSwitchServerById', 'Server connection failed');

    // Add a second server to switch to
    await openAddServerForm(page);
    await fillAddServerForm(page, {
      name: 'Backup Server',
      url: 'http://backup.example:8080',
      username: 'backup-user',
      password: 'backup-secret',
    });
    await addServerForm(page).getByRole('button', { name: 'Test Connection', exact: true }).click();
    await expect(page.getByText('Connection successful!')).toBeVisible();
    await addServerForm(page).getByRole('button', { name: 'Add Server', exact: true }).click();

    // Attempt to switch to Backup Server — the atomic switch should fail visibly
    const backupCard = serverCard(page, 'Backup Server');
    await backupCard.getByRole('button', { name: 'Connect', exact: true }).click();

    // Inline switch error should appear in the panel (switchError state).
    // The injected error contains "connection", which is classified as a network
    // error and rendered with the network message rather than the generic
    // server-switch fallback.
    await expect(page.getByText('Cannot reach the server. Check the address and your network connection.')).toBeVisible({ timeout: 5000 });

    // Verify sessionSwitchServerById was called (atomic path), not selectServer + sessionConnectById
    const call = await readLatestRecordedCall(page, 'servers.sessionSwitchServerById');
    expect(call?.args).toEqual(['mock-server-2']);

    // Neither selectServer nor sessionConnectById should have been called — this proves
    // the previous session was preserved without calling the legacy non-atomic path.
    // The UI's activeServerIdOverride is driven by session events, which mocks do not
    // emit on failure, so we cannot use the Active badge for this assertion.
    const selectServerCalls = (await readRecordedCalls(page)).filter((c) => c.name === 'servers.selectServer');
    const connectCalls = (await readRecordedCalls(page)).filter((c) => c.name === 'sessionConnectById');
    expect(selectServerCalls.length).toBe(0);
    expect(connectCalls.length).toBe(0);
  });

  test('switches the active server from settings', async ({ page }) => {
    await gotoSettingsServers(page, 'connected');
    await openAddServerForm(page);

    await fillAddServerForm(page, {
      name: 'Backup Server',
      url: 'http://backup.example:8080',
      username: 'backup-user',
      password: 'backup-secret',
    });

    await addServerForm(page).getByRole('button', { name: 'Test Connection', exact: true }).click();
    await expect(page.getByText('Connection successful!')).toBeVisible();
    await addServerForm(page).getByRole('button', { name: 'Add Server', exact: true }).click();

    const backupCard = serverCard(page, 'Backup Server');
    await backupCard.getByRole('button', { name: 'Connect', exact: true }).click();

    await expect(backupCard.getByText('Active', { exact: true })).toBeVisible();
    await expect(serverCard(page, 'Mock Server').getByText('Active', { exact: true })).toHaveCount(0);

    // Atomic switch path: servers.sessionSwitchServerById should be called, not selectServer + sessionConnectById
    const call = await readLatestRecordedCall(page, 'servers.sessionSwitchServerById');
    expect(call?.args).toEqual(['mock-server-2']);
  });

  test('removes a saved server from settings', async ({ page }) => {
    await gotoSettingsServers(page, 'connected');
    await openAddServerForm(page);

    await fillAddServerForm(page, {
      name: 'Temporary Server',
      url: 'http://temp.example:8080',
      username: 'temp-user',
      password: 'temp-secret',
    });

    await addServerForm(page).getByRole('button', { name: 'Test Connection', exact: true }).click();
    await expect(page.getByText('Connection successful!')).toBeVisible();
    await addServerForm(page).getByRole('button', { name: 'Add Server', exact: true }).click();

    const tempCard = serverCard(page, 'Temporary Server');
    await tempCard.getByTitle('Delete server').click();

    // The delete flow opens a dialog-host window; navigate to it to interact.
    await waitForMockWebview(page, { dialog: 'server-delete' });
    await gotoDesktop(page, {
      path: '/dialog-host-window',
      appScenario: 'connected',
      scenario: 'empty',
      searchParams: {
        dialog: 'server-delete',
        serverId: 'mock-server-2',
        serverName: 'Temporary Server',
      },
    });

    await expect(page.getByText('Delete "Temporary Server"?')).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    const call = await readLatestRecordedCall(page, 'servers.removeServer');
    expect(call?.args).toEqual(['mock-server-2']);
  });
});
