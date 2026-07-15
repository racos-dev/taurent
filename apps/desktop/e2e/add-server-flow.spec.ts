import { expect, test } from '@playwright/test';
import { gotoDesktop, readRecordedCalls } from './helpers/desktop';

test.describe('first-run add-server flow', () => {
  test('completes the full add-server flow: fill → normalize → add → redirect', async ({ page }) => {
    await gotoDesktop(page, { appScenario: 'no-saved-servers' });

    // Verify we're on the add-server screen
    await expect(page).toHaveURL(/\/add-server$/);
    await expect(page.getByTestId('add-server-screen')).toBeVisible();

    // Fill in the form
    await page.getByPlaceholder('My Home Server').fill('Test Server');
    await page.getByPlaceholder('https://server:8080').fill('http://test.example:8080');
    await page.locator('input').nth(2).fill('admin');
    await page.locator('input[type="password"]').fill('secret');

    // Click "Add Server"
    await page.getByRole('button', { name: 'Add Server' }).click();

    // Verify navigation to home
    await expect(page).toHaveURL(/\/$/);

    // Verify bridge calls
    const calls = await readRecordedCalls(page);
    expect(calls.some((call) => call.name === 'servers.addServer')).toBe(true);
    expect(calls.some((call) => call.name === 'servers.normalizeServerUrl')).toBe(true);
  });

  test('shows URL validation error for invalid URL', async ({ page }) => {
    await gotoDesktop(page, { appScenario: 'no-saved-servers' });

    // Enter a URL with a scheme but missing hostname
    await page.getByPlaceholder('https://server:8080').fill('http://');
    // Trigger blur to ensure validation runs
    await page.getByPlaceholder('admin').click();

    // Verify validation error appears on the URL field
    // new URL('http://') throws, so we get "Invalid URL format"
    await expect(page.getByText(/invalid url format/i)).toBeVisible({ timeout: 10000 });
  });
});
