import { expect, test } from '@playwright/test';
import {
  gotoDesktop,
  readMockWindowLabel,
  readMockWindowVisibility,
  readRecordedCalls,
  submitPrimary,
  failNextMutation,
} from './helpers/desktop';

const TORRENT_1_HASH = 'abcd0000000000000000000000000001';
const TORRENT_2_HASH = 'abcd0000000000000000000000000002';

test.describe('desktop dialog host flows', () => {
  test('renders confirm dialog and cancels without mutating', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=confirm&openId=1',
      appScenario: 'connected',
      scenario: 'empty',
      searchParams: {
        name: 'videos',
        type: 'category',
      },
    });

    await expect(page.getByText('Delete “videos”?')).toBeVisible();
    await expect(page.getByText('Torrents in "videos" will become uncategorized.')).toBeVisible();
    await expect.poll(() => readMockWindowLabel(page)).toBe('dialog-host');

    await page.getByRole('button', { name: 'Cancel', exact: true }).click();

    await expect.poll(() => readMockWindowVisibility(page)).toBe(false);

    const calls = await readRecordedCalls(page);
    expect(calls.some((call) => call.name === 'categories.removeCategories')).toBe(false);
  });

  test('submits confirm dialog for tag deletion', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=confirm&openId=1',
      appScenario: 'connected',
      scenario: 'empty',
      searchParams: {
        name: 'tag-a',
        type: 'tag',
      },
    });

    await expect(page.getByText('Delete “tag-a”?')).toBeVisible();
    await expect(page.getByText('"tag-a" will be removed from all torrents.')).toBeVisible();

    await submitPrimary(page, 'Delete');

    await expect.poll(() => readMockWindowVisibility(page)).toBe(false);

    const calls = await readRecordedCalls(page);
    expect(calls.filter((call) => call.name === 'tags.deleteTags')).toEqual([
      { name: 'tags.deleteTags', args: [['tag-a']] },
    ]);
  });

  test('validates duplicate category names in create dialog', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=create&openId=1',
      appScenario: 'connected',
      scenario: 'empty',
      searchParams: {
        type: 'category',
      },
    });

    await expect(page.getByText('Category name')).toBeVisible();

    const input = page.getByRole('textbox').first();
    await input.fill('videos');

    await expect(page.getByText('A category with this name already exists')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeDisabled();
  });

  test('creates and assigns a new category from create dialog', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=create&openId=1',
      appScenario: 'connected',
      scenario: 'empty',
      searchParams: {
        type: 'category',
        hashes: 'hash-1,hash-2',
      },
    });

    const input = page.getByRole('textbox').first();
    await input.fill('movies');

    await submitPrimary(page, 'Create & Assign');

    await expect.poll(() => readMockWindowVisibility(page)).toBe(false);

    const calls = await readRecordedCalls(page);
    expect(calls).toEqual(
      expect.arrayContaining([
        { name: 'categories.createCategory', args: ['movies', ''] },
        { name: 'torrents.setCategory', args: [['hash-1', 'hash-2'], 'movies'] },
      ]),
    );
  });

  test('submits torrent delete with delete-files enabled', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=torrent-delete&openId=1',
      appScenario: 'connected',
      scenario: 'small-100',
      searchParams: {
        hashes: `${TORRENT_1_HASH},${TORRENT_2_HASH}`,
        count: '2',
      },
    });

    await expect(page.getByText('Delete 2 torrents?')).toBeVisible();
    await expect(page.getByText('Torrents will be removed. Downloaded files will be kept.')).toBeVisible();

    await page.getByRole('checkbox', { name: 'Also delete files' }).check();
    await expect(page.getByText('Torrents and their files will be permanently deleted.')).toBeVisible();

    await submitPrimary(page, 'Delete');

    await expect.poll(() => readMockWindowVisibility(page)).toBe(false);

    const calls = await readRecordedCalls(page);
    expect(calls).toEqual(
      expect.arrayContaining([
        {
          name: 'torrents.delete',
          args: [[TORRENT_1_HASH, TORRENT_2_HASH], true],
        },
      ]),
    );
  });

  test('resets a torrent category from the category-select dialog', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=category-select&openId=1',
      appScenario: 'connected',
      scenario: 'small-100',
      searchParams: {
        hashes: TORRENT_1_HASH,
      },
    });

    await expect(page.getByText('Select category for 1 torrent')).toBeVisible();

    await page.getByRole('button', { name: '(None) — Reset category', exact: true }).click();

    await expect.poll(() => readMockWindowVisibility(page)).toBe(false);

    const calls = await readRecordedCalls(page);
    expect(calls).toEqual(
      expect.arrayContaining([
        {
          name: 'torrents.setCategory',
          args: [[TORRENT_1_HASH], ''],
        },
      ]),
    );
  });

  test('adds an unassigned tag from the tag-select dialog', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=tag-select&openId=1',
      appScenario: 'connected',
      scenario: 'small-100',
      searchParams: {
        hashes: TORRENT_1_HASH,
      },
    });

    await expect(page.getByText('Select tags to add or remove from 1 torrent')).toBeVisible();
    await expect(page.getByText('assigned')).toBeVisible();

    await page.locator('label').filter({ hasText: 'tag-a' }).getByRole('checkbox').check();
    await submitPrimary(page, 'Add Tags');

    await expect.poll(() => readMockWindowVisibility(page)).toBe(false);

    const calls = await readRecordedCalls(page);
    expect(calls).toEqual(
      expect.arrayContaining([
        {
          name: 'torrents.addTags',
          args: [[TORRENT_1_HASH], ['tag-a']],
        },
      ]),
    );
  });

  test('removes an assigned tag from the tag-select dialog', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=tag-select&openId=1',
      appScenario: 'connected',
      scenario: 'small-100',
      searchParams: {
        hashes: TORRENT_1_HASH,
      },
    });

    await page.locator('label').filter({ hasText: 'tag-c' }).getByRole('checkbox').check();
    await submitPrimary(page, 'Remove Tags');

    await expect.poll(() => readMockWindowVisibility(page)).toBe(false);

    const calls = await readRecordedCalls(page);
    expect(calls).toEqual(
      expect.arrayContaining([
        {
          name: 'torrents.removeTags',
          args: [[TORRENT_1_HASH], ['tag-c']],
        },
      ]),
    );
  });

  test('torrent-text submits rename', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=torrent-text&openId=1',
      appScenario: 'connected',
      scenario: 'small-100',
      searchParams: {
        type: 'rename',
        value: 'Torrent 1',
        hashes: TORRENT_1_HASH,
      },
    });

    await page.getByPlaceholder('New name').fill('Renamed Torrent');
    await submitPrimary(page, 'Rename');

    await expect.poll(() => readMockWindowVisibility(page)).toBe(false);

    const calls = await readRecordedCalls(page);
    expect(calls).toEqual(
      expect.arrayContaining([
        { name: 'torrents.setName', args: [TORRENT_1_HASH, 'Renamed Torrent'] },
      ]),
    );
  });

  test('torrent-text failure keeps the dialog open with the entered value', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=torrent-text&openId=1',
      appScenario: 'connected',
      scenario: 'small-100',
      searchParams: {
        type: 'rename',
        value: 'Torrent 1',
        hashes: TORRENT_1_HASH,
      },
    });

    await failNextMutation(page, 'torrents.setName', 'Rename failed');
    const input = page.getByPlaceholder('New name');
    await input.fill('Still Here');
    await submitPrimary(page, 'Rename');

    await expect(page.getByText('Rename Torrent', { exact: true })).toBeVisible();
    await expect(page.getByText('Torrent action failed. Try again.')).toBeVisible();
    await expect(input).toHaveValue('Still Here');
  });


  // ─── torrent-numeric ────────────────────────────────────────────────────────

  test('torrent-numeric renders download limit payload', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=torrent-numeric&openId=1',
      appScenario: 'connected',
      scenario: 'small-100',
      searchParams: {
        type: 'download',
        value: String(512 * 1024),
        hashes: TORRENT_1_HASH,
      },
    });

    await expect(page.getByText('Download Limit', { exact: true })).toBeVisible();
    await expect(page.getByText('0 = unlimited')).toBeVisible();
    await expect(page.locator('input[type="number"]')).toHaveValue('512');
  });

  test('torrent-numeric cancels without mutating', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=torrent-numeric&openId=1',
      appScenario: 'connected',
      scenario: 'small-100',
      searchParams: {
        type: 'download',
        value: String(512 * 1024),
        hashes: TORRENT_1_HASH,
      },
    });

    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect.poll(() => readMockWindowVisibility(page)).toBe(false);

    const calls = await readRecordedCalls(page);
    expect(calls.some((call) => call.name === 'torrents.setDownloadLimit')).toBe(false);
  });

  test('torrent-numeric submits download limit', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=torrent-numeric&openId=1',
      appScenario: 'connected',
      scenario: 'small-100',
      searchParams: {
        type: 'download',
        value: String(512 * 1024),
        hashes: TORRENT_1_HASH,
      },
    });

    await page.locator('input[type="number"]').fill('1024');
    await submitPrimary(page, 'Set');

    await expect.poll(() => readMockWindowVisibility(page)).toBe(false);

    const calls = await readRecordedCalls(page);
    expect(calls).toEqual(
      expect.arrayContaining([
        { name: 'torrents.setDownloadLimit', args: [[TORRENT_1_HASH], 1024 * 1024] },
      ]),
    );
  });

  test('torrent-numeric failure keeps the dialog open with the entered value', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=torrent-numeric&openId=1',
      appScenario: 'connected',
      scenario: 'small-100',
      searchParams: {
        type: 'download',
        value: String(512 * 1024),
        hashes: TORRENT_1_HASH,
      },
    });

    await failNextMutation(page, 'torrents.setDownloadLimit', 'Per-torrent limit failed');
    const input = page.locator('input[type="number"]');
    await input.fill('2048');
    await submitPrimary(page, 'Set');

    await expect(page.getByText('Download Limit', { exact: true })).toBeVisible();
    await expect(page.getByText('Torrent action failed. Try again.')).toBeVisible();
    await expect(input).toHaveValue('2048');
  });

  // ─── torrent-share-limits ───────────────────────────────────────────────────

  test('torrent-share-limits renders the initial sentinel payload', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=torrent-share-limits&openId=1',
      appScenario: 'connected',
      scenario: 'small-100',
      searchParams: {
        ratio: '-2',
        seedingTime: '-2',
        hashes: TORRENT_1_HASH,
      },
    });

    await expect(page.getByText('Limit Share Ratio', { exact: true })).toBeVisible();
    await expect(page.getByTestId('ratio-limit-select')).toContainText('Global setting');
    await expect(page.getByTestId('seeding-time-limit-select')).toContainText('Global setting');
  });

  test('torrent-share-limits cancels without mutating', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=torrent-share-limits&openId=1',
      appScenario: 'connected',
      scenario: 'small-100',
      searchParams: {
        ratio: '-2',
        seedingTime: '-2',
        hashes: TORRENT_1_HASH,
      },
    });

    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect.poll(() => readMockWindowVisibility(page)).toBe(false);

    const calls = await readRecordedCalls(page);
    expect(calls.some((call) => call.name === 'torrents.setShareLimits')).toBe(false);
  });

  test('torrent-share-limits submits custom ratio and seeding values', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=torrent-share-limits&openId=1',
      appScenario: 'connected',
      scenario: 'small-100',
      searchParams: {
        ratio: '-2',
        seedingTime: '-2',
        hashes: TORRENT_1_HASH,
      },
    });
    await page.getByTestId('ratio-limit-select').click();
    await page.getByRole('option', { name: 'Custom ratio' }).click();
    await page.locator('input[type="number"]').nth(0).fill('2.5');
    await page.getByTestId('seeding-time-limit-select').click();
    await page.getByRole('option', { name: 'Custom (minutes)' }).click();
    await page.locator('input[type="number"]').nth(1).fill('90');
    await submitPrimary(page, 'Set');

    await expect.poll(() => readMockWindowVisibility(page)).toBe(false);

    const calls = await readRecordedCalls(page);
    expect(calls).toEqual(
      expect.arrayContaining([
        { name: 'torrents.setShareLimits', args: [[TORRENT_1_HASH], 2.5, 90] },
      ]),
    );
  });

  test('torrent-share-limits failure keeps the dialog open with entered values', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=torrent-share-limits&openId=1',
      appScenario: 'connected',
      scenario: 'small-100',
      searchParams: {
        ratio: '-2',
        seedingTime: '-2',
        hashes: TORRENT_1_HASH,
      },
    });

    await failNextMutation(page, 'torrents.setShareLimits', 'Share limits failed');
    await page.getByTestId('ratio-limit-select').click();
    await page.getByRole('option', { name: 'Custom ratio' }).click();
    await page.locator('input[type="number"]').nth(0).fill('3.5');
    await page.getByTestId('seeding-time-limit-select').click();
    await page.getByRole('option', { name: 'Custom (minutes)' }).click();
    await page.locator('input[type="number"]').nth(1).fill('120');
    await submitPrimary(page, 'Set');

    await expect(page.getByText('Limit Share Ratio', { exact: true })).toBeVisible();
    await expect(page.getByText('Torrent action failed. Try again.')).toBeVisible();
    await expect(page.locator('input[type="number"]').nth(0)).toHaveValue('3.5');
    await expect(page.locator('input[type="number"]').nth(1)).toHaveValue('120');
  });

  // ─── edit-category ──────────────────────────────────────────────────────────

  test('edit-category renders with disabled name and enabled save path', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=edit-category&openId=1',
      appScenario: 'connected',
      scenario: 'empty',
      searchParams: {
        name: 'videos',
        savePath: '/data/videos',
      },
    });

    await expect(page.getByText('Category name')).toBeVisible();
    const nameInput = page.locator('input').first();
    await expect(nameInput).toBeDisabled();

    await expect(page.getByText('Save path', { exact: true })).toBeVisible();
    const savePathInput = page.locator('input').nth(1);
    await expect(savePathInput).toBeEnabled();
    await expect(savePathInput).toHaveValue('/data/videos');

    // Save button disabled when no change
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  });

  test('edit-category cancels without mutating', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=edit-category&openId=1',
      appScenario: 'connected',
      scenario: 'empty',
      searchParams: {
        name: 'videos',
        savePath: '/data/videos',
      },
    });

    const savePathInput = page.locator('input').nth(1);
    await savePathInput.fill('/new/path');

    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect.poll(() => readMockWindowVisibility(page)).toBe(false);

    const calls = await readRecordedCalls(page);
    expect(calls.some((call) => call.name === 'categories.editCategory')).toBe(false);
  });

  test('edit-category submits changed save path', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=edit-category&openId=1',
      appScenario: 'connected',
      scenario: 'empty',
      searchParams: {
        name: 'videos',
        savePath: '/data/videos',
      },
    });

    const savePathInput = page.locator('input').nth(1);
    await savePathInput.fill('/data/movies');

    await submitPrimary(page, 'Save');
    await expect.poll(() => readMockWindowVisibility(page)).toBe(false);

    const calls = await readRecordedCalls(page);
    expect(calls).toEqual(
      expect.arrayContaining([
        { name: 'categories.editCategory', args: ['videos', '/data/movies'] },
      ]),
    );
  });

  test('edit-category failure path keeps dialog open with error', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=edit-category&openId=1',
      appScenario: 'connected',
      scenario: 'empty',
      searchParams: {
        name: 'videos',
        savePath: '/data/videos',
      },
    });

    await failNextMutation(page, 'categories.editCategory', 'Save path is not writable');

    const savePathInput = page.locator('input').nth(1);
    await savePathInput.fill('/data/movies');

    await submitPrimary(page, 'Save');

    // Dialog stays open
    await expect(page.getByText('Save path', { exact: true })).toBeVisible();
    await expect(page.getByText('Could not save settings. Try again.')).toBeVisible();

    const calls = await readRecordedCalls(page);
    expect(calls).toEqual(
      expect.arrayContaining([
        { name: 'categories.editCategory', args: ['videos', '/data/movies'] },
      ]),
    );
  });

  // ─── transfer-limit ────────────────────────────────────────────────────────

  test('transfer-limit renders global download limit', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=transfer-limit&openId=1',
      appScenario: 'connected',
      scenario: 'empty',
      searchParams: {
        direction: 'download',
        value: String(512 * 1024),
        isAltSpeed: '0',
      },
    });

    await expect(page.getByText('Download Limit')).toBeVisible();
    await expect(page.getByText('0 = unlimited')).toBeVisible();

    const input = page.locator('input[type="number"]');
    await expect(input).toHaveValue('512');

    await expect(page.getByRole('button', { name: 'Set', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
  });

  test('transfer-limit cancels without mutating', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=transfer-limit&openId=1',
      appScenario: 'connected',
      scenario: 'empty',
      searchParams: {
        direction: 'download',
        value: String(512 * 1024),
        isAltSpeed: '0',
      },
    });

    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect.poll(() => readMockWindowVisibility(page)).toBe(false);

    const calls = await readRecordedCalls(page);
    expect(calls.some((call) => call.name === 'transfer.setDownloadLimit')).toBe(false);
  });

  test('transfer-limit submits global download limit', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=transfer-limit&openId=1',
      appScenario: 'connected',
      scenario: 'empty',
      searchParams: {
        direction: 'download',
        value: String(512 * 1024),
        isAltSpeed: '0',
      },
    });

    const input = page.locator('input[type="number"]');
    await input.fill('1024');

    await submitPrimary(page, 'Set');
    await expect.poll(() => readMockWindowVisibility(page)).toBe(false);

    const calls = await readRecordedCalls(page);
    expect(calls).toEqual(
      expect.arrayContaining([
        { name: 'transfer.setDownloadLimit', args: [1024 * 1024] },
      ]),
    );
  });

  test('transfer-limit submits alt-speed upload limit via application.setPreferences', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=transfer-limit&openId=1',
      appScenario: 'connected',
      scenario: 'empty',
      searchParams: {
        direction: 'upload',
        value: String(256 * 1024),
        isAltSpeed: '1',
      },
    });

    await expect(page.getByText('Alt Upload Limit')).toBeVisible();

    const input = page.locator('input[type="number"]');
    await input.fill('128');

    await submitPrimary(page, 'Set');
    await expect.poll(() => readMockWindowVisibility(page)).toBe(false);

    const calls = await readRecordedCalls(page);
    expect(calls).toEqual(
      expect.arrayContaining([
        { name: 'application.setPreferences', args: [{ alt_up_limit: 128 * 1024 }] },
      ]),
    );
  });

  test('transfer-limit failure path keeps dialog open', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=transfer-limit&openId=1',
      appScenario: 'connected',
      scenario: 'empty',
      searchParams: {
        direction: 'download',
        value: String(512 * 1024),
        isAltSpeed: '0',
      },
    });

    await failNextMutation(page, 'transfer.setDownloadLimit', 'Rate limit cannot be set');

    const input = page.locator('input[type="number"]');
    await input.fill('1024');

    await submitPrimary(page, 'Set');

    await expect(page.getByText('Download Limit')).toBeVisible();
    await expect(page.getByText('Could not update speed limits. Try again.')).toBeVisible();

    const calls = await readRecordedCalls(page);
    expect(calls).toEqual(
      expect.arrayContaining([
        { name: 'transfer.setDownloadLimit', args: [1024 * 1024] },
      ]),
    );
  });

  test('transfer-limit zero/unlimited path — zero value submits as zero', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=transfer-limit&openId=1',
      appScenario: 'connected',
      scenario: 'empty',
      searchParams: {
        direction: 'download',
        value: String(1024 * 1024),
        isAltSpeed: '0',
      },
    });

    const input = page.locator('input[type="number"]');
    await input.fill('0');

    await submitPrimary(page, 'Set');
    await expect.poll(() => readMockWindowVisibility(page)).toBe(false);

    const calls = await readRecordedCalls(page);
    expect(calls).toEqual(
      expect.arrayContaining([
        { name: 'transfer.setDownloadLimit', args: [0] },
      ]),
    );
  });
});
