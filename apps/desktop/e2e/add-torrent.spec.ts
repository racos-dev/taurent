import { expect, test } from '@playwright/test';
import {
  failNextMutation,
  fillMagnet,
  gotoDesktop,
  readLatestRecordedCall,
  readPendingMutationFailure,
  readRecordedCalls,
  submitPrimary,
  waitForHomeReady,
} from './helpers/desktop';

test.describe('desktop add torrent flows', () => {
  test('submits a magnet from the main route with desktop options', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/add-torrent',
      appScenario: 'connected',
      scenario: 'empty',
    });

    const magnet = 'magnet:?xt=urn:btih:0123456789ABCDEF0123456789ABCDEF01234567';
    await fillMagnet(page, magnet);
    await page.getByPlaceholder('Default download path').fill('/data/watch');
    await page.getByPlaceholder('tag1, tag2, ...').fill('nightly');
    await page.keyboard.press('Enter');
    await page.getByRole('checkbox', { name: 'Start torrent' }).uncheck();

    await submitPrimary(page);

    await waitForHomeReady(page);

    const recorded = await readLatestRecordedCall(page, 'torrents.addTorrent');
    expect(recorded).not.toBeNull();
    expect(recorded?.args[0]).toMatchObject({
      urls: magnet,
      savepath: '/data/watch',
      tags: 'nightly',
      paused: true,
    });
  });

  test('validates invalid magnet input in the auxiliary window', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/add-torrent-window',
      appScenario: 'connected',
      scenario: 'empty',
    });

    await fillMagnet(page, 'not-a-magnet');
    await submitPrimary(page);

    await expect(page.getByText('Invalid URL or magnet format')).toBeVisible();

    const calls = await readRecordedCalls(page);
    expect(calls.some((call) => call.name === 'torrents.addTorrent')).toBe(false);
  });

  test('keeps the form open when add torrent fails', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/add-torrent-window',
      appScenario: 'connected',
      scenario: 'empty',
    });

    const magnet = 'magnet:?xt=urn:btih:89ABCDEF0123456789ABCDEF0123456789ABCDEF';
    await failNextMutation(page, 'torrents.addTorrent', 'Bridge add failed');
    await fillMagnet(page, magnet);
    await page.getByPlaceholder('Default download path').fill('/downloads/fail-case');

    await submitPrimary(page);

    await expect(page).toHaveURL(/\/add-torrent-window\?/);
    await expect(page.getByPlaceholder('Default download path')).toHaveValue('/downloads/fail-case');
    await expect(page.getByPlaceholder('magnet:?xt=urn:btih:...')).toHaveValue(magnet);
    await expect(page.getByRole('button', { name: 'Add Torrent', exact: true })).toBeEnabled();

    const calls = await readRecordedCalls(page);
    expect(calls.filter((call) => call.name === 'torrents.addTorrent')).toHaveLength(1);

    const pendingFailure = await readPendingMutationFailure(page);
    expect(pendingFailure).toBeNull();
  });

  test('submits an aux-window magnet from the url param', async ({ page }) => {
    const magnet = 'magnet:?xt=urn:btih:1234567890ABCDEF1234567890ABCDEF12345678';

    await gotoDesktop(page, {
      path: `/add-torrent-window?url=${encodeURIComponent(magnet)}`,
      appScenario: 'connected',
      scenario: 'empty',
    });

    await expect(page.getByPlaceholder('magnet:?xt=urn:btih:...')).toHaveValue(magnet);

    await submitPrimary(page);

    const recorded = await readLatestRecordedCall(page, 'torrents.addTorrent');
    expect(recorded).not.toBeNull();
    expect(recorded?.args[0]).toMatchObject({
      urls: magnet,
    });
  });

  test('submits torrent files from the files param with combined options', async ({ page }) => {
    const files = ['/imports/linux-alpha.torrent', '/imports/linux-beta.torrent'];

    await gotoDesktop(page, {
      path: `/add-torrent?files=${encodeURIComponent(JSON.stringify(files))}`,
      appScenario: 'connected',
      scenario: 'empty',
    });

    await expect(page.getByText('2 files selected')).toBeVisible();
    await expect(page.getByText('linux-alpha.torrent')).toBeVisible();
    await expect(page.getByText('linux-beta.torrent')).toBeVisible();

    await page.getByPlaceholder('Default download path').fill('/data/phase-6');
    await page.getByTestId('category-select').click();
    await page.getByRole('option', { name: 'videos' }).click();

    const tagField = page.locator('label', { hasText: 'Tags' }).locator('..');
    const tagInput = tagField.locator('input[type="text"]');
    await tagInput.fill('phase-6-a');
    await page.keyboard.press('Enter');
    await tagInput.fill('phase-6-b');
    await page.keyboard.press('Enter');

    await page.getByRole('checkbox', { name: 'Start torrent' }).uncheck();

    const downloadLimit = page.locator('label', { hasText: 'Limit download rate' }).locator('..');
    await downloadLimit.getByRole('checkbox').check();
    await downloadLimit.locator('input[type="number"]').fill('512');

    const uploadLimit = page.locator('label', { hasText: 'Limit upload rate' }).locator('..');
    await uploadLimit.getByRole('checkbox').check();
    await uploadLimit.locator('input[type="number"]').fill('128');

    await submitPrimary(page);

    await waitForHomeReady(page);

    const recorded = await readLatestRecordedCall(page, 'torrents.addTorrent');
    expect(recorded).not.toBeNull();
    expect(recorded?.args[0]).toMatchObject({
      torrentFiles: files,
      savepath: '/data/phase-6',
      category: 'videos',
      tags: 'phase-6-a,phase-6-b',
      paused: true,
      dl_limit: 512 * 1024,
      up_limit: 128 * 1024,
    });
  });
});
