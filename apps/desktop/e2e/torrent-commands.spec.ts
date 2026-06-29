import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  getFirstVisibleTorrentRow,
  getTorrentRowLocator,
  getVisibleTorrentRow,
  gotoDesktop,
  readRecordedCalls,
  readTorrentRowHash,
  submitPrimary,
  waitForHomeReady,
  waitForMockWebview,
} from './helpers/desktop';

const TORRENT_HASH_PATTERN = /^abcd[0-9a-f]{28}$/;

async function clearAutomationState(page: Page) {
  await page.evaluate(() => {
    window.__TAURENT_TAURI_WEBVIEWS__?.clearWindows();
    window.__TAURENT_AUTOMATION__?.clearRecordedCalls();
  });
}

async function loadMainWindow(page: Page) {
  await gotoDesktop(page, { scenario: 'small-100', appScenario: 'connected' });
  await waitForHomeReady(page);
  // `waitForHomeReady` returns when the home shell first appears (the empty
  // "No torrents found" surface flashes in before the maindata merge
  // paints real rows). The command tests target the small-100 scenario
  // and need actual `[data-testid="torrent-row"]` nodes before reading
  // row attributes - wait for that stable, rendered-row signal here.
  //
  // T149.4 makes backend-owned sync the authoritative desktop main-window
  // path, and `useMaindataSyncBackend` normalizes every snapshot/event
  // through `normalizeBackendMaindata` so torrent objects always carry
  // `hash` from the keyed map. `data-torrent-hash` is therefore populated
  // before this row visibility signal lands, so no test-side hash
  // re-injection is needed. Per-row hash polling happens in
  // `readRequiredTorrentRowHash` below.
  await expect(getTorrentRowLocator(page).first()).toBeVisible({ timeout: 15_000 });
  await clearAutomationState(page);
}

async function openDialogHost(
  page: Page,
  dialog: string,
  searchParams: Record<string, string> = {},
) {
  await gotoDesktop(page, {
    path: `/dialog-host-window?dialog=${dialog}&openId=1`,
    scenario: 'small-100',
    appScenario: 'connected',
    searchParams,
  });
  await clearAutomationState(page);
}

// Main context menu panel - distinguished from the submenu flyout by the
// `data-contextmenu-type` attribute the ContextMenuPanel sets.
function mainMenu(page: Page): Locator {
  return page.locator('[data-contextmenu-type="menu"]');
}

// Submenu flyout rendered when a submenu trigger (e.g. Category, Tags) opens
// its children. Targets scoped to this locator only see submenu items, never
// the top-level trigger row.
function subMenu(page: Page): Locator {
  return page.locator('[data-contextmenu-type="submenu"]');
}

function getTorrentRowByState(page: Page, state: string): Locator {
  return page.locator(`[data-testid="torrent-row"][data-torrent-state="${state}"]`).first();
}

async function openContextMenuForRow(row: Locator, page: Page) {
  await row.scrollIntoViewIfNeeded();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click({ button: 'right' });
  try {
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 1_000 });
  } catch {
    const box = await row.boundingBox();
    if (box == null) {
      throw new Error('Cannot dispatch row context menu without a row bounding box.');
    }
    await row.dispatchEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
      buttons: 2,
      clientX: Math.round(box.x + Math.min(24, box.width / 2)),
      clientY: Math.round(box.y + box.height / 2),
    });
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 5_000 });
  }
  await expect(mainMenu(page)).toBeVisible();
}

async function clickMenuItem(page: Page, label: string) {
  await mainMenu(page).getByRole('menuitem', { name: label, exact: true }).click();
}

async function hoverMenuItem(page: Page, label: string) {
  await mainMenu(page).getByRole('menuitem', { name: label, exact: true }).hover();
}

async function clickSubMenuItem(page: Page, label: string) {
  await expect(subMenu(page)).toBeVisible({ timeout: 5_000 });
  const item = subMenu(page).getByRole('menuitem', { name: label, exact: true });
  await expect(item).toBeEnabled();
  await item.evaluate((element) => {
    if (!(element instanceof HTMLButtonElement)) {
      throw new Error('Expected submenu item to render as a button.');
    }
    element.click();
  });
}

async function readRequiredTorrentRowHash(row: Locator): Promise<string> {
  let hash: string | null = null;
  await expect
    .poll(async () => {
      hash = await readTorrentRowHash(row);
      return hash ?? '';
    }, { timeout: 15_000 })
    .toMatch(TORRENT_HASH_PATTERN);

  return hash!;
}

async function selectRowForToolbarCommand(page: Page, row: Locator, toolbarTestId: string) {
  await row.scrollIntoViewIfNeeded();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  await expect(page.getByTestId(toolbarTestId)).toBeEnabled({ timeout: 5_000 });
}

async function expectRecordedCall(page: Page, name: string) {
  await expect
    .poll(async () => {
      const calls = await readRecordedCalls(page);
      return calls.find((entry) => entry.name === name) ?? null;
    })
    .not.toBeNull();

  const calls = await readRecordedCalls(page);
  return calls.find((entry) => entry.name === name)!;
}

test.describe('desktop torrent commands', () => {
  test('pauses and resumes the selected torrent from the toolbar', async ({ page }) => {
    await loadMainWindow(page);
    const pauseRow = getTorrentRowByState(page, 'downloading');
    const pauseHash = await readRequiredTorrentRowHash(pauseRow);
    const resumeRow = getTorrentRowByState(page, 'pausedDL');
    const resumeHash = await readRequiredTorrentRowHash(resumeRow);

    await selectRowForToolbarCommand(page, pauseRow, 'toolbar-pause');
    await page.getByTestId('toolbar-pause').click();

    let call = await expectRecordedCall(page, 'torrents.pause');
    expect(call.args).toEqual([[pauseHash]]);

    await clearAutomationState(page);
    await selectRowForToolbarCommand(page, resumeRow, 'toolbar-resume');
    await page.getByTestId('toolbar-resume').click();

    call = await expectRecordedCall(page, 'torrents.resume');
    expect(call.args).toEqual([[resumeHash]]);
  });

  test('pauses, resumes, force-starts, rechecks, and reannounces from the context menu', async ({ page }) => {
    await loadMainWindow(page);
    const pauseRow = getTorrentRowByState(page, 'downloading');
    const pauseHash = await readRequiredTorrentRowHash(pauseRow);
    const resumeRow = getTorrentRowByState(page, 'pausedDL');
    const resumeHash = await readRequiredTorrentRowHash(resumeRow);

    await openContextMenuForRow(pauseRow, page);
    await clickMenuItem(page, 'Pause');
    let call = await expectRecordedCall(page, 'torrents.pause');
    expect(call.args).toEqual([[pauseHash]]);

    await clearAutomationState(page);
    await openContextMenuForRow(resumeRow, page);
    await clickMenuItem(page, 'Start');
    call = await expectRecordedCall(page, 'torrents.resume');
    expect(call.args).toEqual([[resumeHash]]);

    await clearAutomationState(page);
    await openContextMenuForRow(pauseRow, page);
    await clickMenuItem(page, 'Force Start');
    call = await expectRecordedCall(page, 'torrents.setForceStart');
    expect(call.args).toEqual([[pauseHash], true]);

    await clearAutomationState(page);
    await openContextMenuForRow(pauseRow, page);
    await clickMenuItem(page, 'Force Recheck');
    call = await expectRecordedCall(page, 'torrents.recheck');
    expect(call.args).toEqual([[pauseHash]]);

    await clearAutomationState(page);
    await openContextMenuForRow(pauseRow, page);
    await clickMenuItem(page, 'Force Reannounce');
    call = await expectRecordedCall(page, 'torrents.reannounce');
    expect(call.args).toEqual([[pauseHash]]);
  });

  test('queues and reprioritizes the selected torrent from the toolbar', async ({ page }) => {
    await loadMainWindow(page);
    const firstRow = getFirstVisibleTorrentRow(page);
    const expectedHash = await readRequiredTorrentRowHash(firstRow);

    await selectRowForToolbarCommand(page, firstRow, 'toolbar-queue-up');
    await page.getByTestId('toolbar-queue-up').click();
    let call = await expectRecordedCall(page, 'torrents.increasePriority');
    expect(call.args).toEqual([[expectedHash]]);

    await clearAutomationState(page);
    await selectRowForToolbarCommand(page, firstRow, 'toolbar-queue-down');
    await page.getByTestId('toolbar-queue-down').click();
    call = await expectRecordedCall(page, 'torrents.decreasePriority');
    expect(call.args).toEqual([[expectedHash]]);

    await clearAutomationState(page);
    await selectRowForToolbarCommand(page, firstRow, 'toolbar-move-top');
    await page.getByTestId('toolbar-move-top').click();
    call = await expectRecordedCall(page, 'torrents.topPriority');
    expect(call.args).toEqual([[expectedHash]]);

    await clearAutomationState(page);
    await selectRowForToolbarCommand(page, firstRow, 'toolbar-move-bottom');
    await page.getByTestId('toolbar-move-bottom').click();
    call = await expectRecordedCall(page, 'torrents.bottomPriority');
    expect(call.args).toEqual([[expectedHash]]);
  });

  test('opens the delete dialog from the main window and submits delete', async ({ page }) => {
    await loadMainWindow(page);
    const row = getFirstVisibleTorrentRow(page);
    const expectedHash = await readRequiredTorrentRowHash(row);

    await openContextMenuForRow(row, page);
    await clickMenuItem(page, 'Remove');

    // Dialog-opening actions go through an async webview create. Wait for
    // the mocked webview to record the dialog-host open before navigating
    // the main page to the dialog-host route.
    await waitForMockWebview(page, { dialog: 'torrent-delete' });

    await openDialogHost(page, 'torrent-delete', { hashes: expectedHash, count: '1' });
    await expect(page.getByText('Delete this torrent?')).toBeVisible();
    await submitPrimary(page, 'Delete');

    const call = await expectRecordedCall(page, 'torrents.delete');
    expect(call.args).toEqual([[expectedHash], false]);
  });

  test('opens the rename dialog from the main window and submits rename', async ({ page }) => {
    await loadMainWindow(page);
    const row = getFirstVisibleTorrentRow(page);
    const expectedHash = await readRequiredTorrentRowHash(row);

    await openContextMenuForRow(row, page);
    await clickMenuItem(page, 'Rename...');

    await waitForMockWebview(page, { dialog: 'torrent-text', type: 'rename' });

    await openDialogHost(page, 'torrent-text', {
      type: 'rename',
      value: 'Torrent 1',
      hashes: expectedHash,
    });
    await expect(page.getByText('Rename Torrent')).toBeVisible();
    await page.getByRole('textbox').fill('Renamed Torrent');
    await submitPrimary(page, 'Rename');

    const call = await expectRecordedCall(page, 'torrents.setName');
    expect(call.args).toEqual([expectedHash, 'Renamed Torrent']);
  });

  test('opens the set-location dialog from the main window and submits move', async ({ page }) => {
    await loadMainWindow(page);
    const row = getFirstVisibleTorrentRow(page);
    const expectedHash = await readRequiredTorrentRowHash(row);

    await openContextMenuForRow(row, page);
    await clickMenuItem(page, 'Set Location...');

    await waitForMockWebview(page, { dialog: 'torrent-text', type: 'setLocation' });

    await openDialogHost(page, 'torrent-text', {
      type: 'setLocation',
      value: '/save/path/1',
      hashes: expectedHash,
    });
    await expect(page.getByText('Set Location')).toBeVisible();
    await page.getByRole('textbox').fill('/new/path');
    await submitPrimary(page, 'Move');

    const call = await expectRecordedCall(page, 'torrents.setLocation');
    expect(call.args).toEqual([[expectedHash], '/new/path']);
  });

  test('opens the category create flow and assigns or resets category from the main window', async ({ page }) => {
    await loadMainWindow(page);
    const firstRow = getFirstVisibleTorrentRow(page);
    const expectedHash = await readRequiredTorrentRowHash(firstRow);

    await openContextMenuForRow(firstRow, page);
    await hoverMenuItem(page, 'Category');
    await clickSubMenuItem(page, 'New...');

    await waitForMockWebview(page, { dialog: 'create', type: 'category' });

    await clearAutomationState(page);
    await openContextMenuForRow(firstRow, page);
    await hoverMenuItem(page, 'Category');
    await clickSubMenuItem(page, 'videos');

    let call = await expectRecordedCall(page, 'torrents.setCategory');
    expect(call.args).toEqual([[expectedHash], 'videos']);

    await clearAutomationState(page);
    await openContextMenuForRow(firstRow, page);
    await hoverMenuItem(page, 'Category');
    await clickSubMenuItem(page, 'Reset');

    call = await expectRecordedCall(page, 'torrents.setCategory');
    expect(call.args).toEqual([[expectedHash], '']);
  });

  test('opens the tag create flow from the main window', async ({ page }) => {
    await loadMainWindow(page);
    const tagRow = getVisibleTorrentRow(page, 1);

    await openContextMenuForRow(tagRow, page);
    await hoverMenuItem(page, 'Tags');
    await clickSubMenuItem(page, 'Add...');

    await waitForMockWebview(page, { dialog: 'create', type: 'tag' });
  });

  test('opens the per-torrent limit dialogs from the main window and submits each mutation', async ({ page }) => {
    await loadMainWindow(page);
    let row = getFirstVisibleTorrentRow(page);
    let expectedHash = await readRequiredTorrentRowHash(row);

    await openContextMenuForRow(row, page);
    await clickMenuItem(page, 'Limit Download Rate...');
    await waitForMockWebview(page, { dialog: 'torrent-numeric', type: 'download' });

    await openDialogHost(page, 'torrent-numeric', {
      type: 'download',
      value: '0',
      hashes: expectedHash,
    });
    await page.getByRole('spinbutton').fill('512');
    await submitPrimary(page, 'Set');
    let call = await expectRecordedCall(page, 'torrents.setDownloadLimit');
    expect(call.args).toEqual([[expectedHash], 512 * 1024]);

    await loadMainWindow(page);
    row = getFirstVisibleTorrentRow(page);
    expectedHash = await readRequiredTorrentRowHash(row);
    await openContextMenuForRow(row, page);
    await clickMenuItem(page, 'Limit Upload Rate...');
    await waitForMockWebview(page, { dialog: 'torrent-numeric', type: 'upload' });

    await openDialogHost(page, 'torrent-numeric', {
      type: 'upload',
      value: '0',
      hashes: expectedHash,
    });
    await page.getByRole('spinbutton').fill('128');
    await submitPrimary(page, 'Set');
    call = await expectRecordedCall(page, 'torrents.setUploadLimit');
    expect(call.args).toEqual([[expectedHash], 128 * 1024]);

    await loadMainWindow(page);
    row = getFirstVisibleTorrentRow(page);
    expectedHash = await readRequiredTorrentRowHash(row);
    await openContextMenuForRow(row, page);
    await clickMenuItem(page, 'Limit Share Ratio...');
    await waitForMockWebview(page, { dialog: 'torrent-share-limits' });

    await openDialogHost(page, 'torrent-share-limits', {
      ratio: '-2',
      seedingTime: '-2',
      hashes: expectedHash,
    });
    await page.getByTestId('ratio-limit-select').click();
    await page.getByRole('option', { name: 'Unlimited' }).click();
    await page.getByTestId('seeding-time-limit-select').click();
    await page.getByRole('option', { name: 'Unlimited' }).click();
    await submitPrimary(page, 'Set');
    call = await expectRecordedCall(page, 'torrents.setShareLimits');
    expect(call.args).toEqual([[expectedHash], -1, -1]);
  });
});
