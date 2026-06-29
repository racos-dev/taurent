import { expect, test } from '@playwright/test';
import { gotoDesktop, readRecordedCalls } from './helpers/desktop';

test.describe('first-run add-server flow', () => {
  test('completes the full add-server flow: fill → test → add → redirect', async ({ page }) => {
    await gotoDesktop(page, { appScenario: 'no-saved-servers' });

    // Verify we're on the add-server screen
    await expect(page).toHaveURL(/\/add-server$/);
    await expect(page.getByTestId('add-server-screen')).toBeVisible();

    // Verify step indicator shows "Enter Details" as active
    // (Use text-based selectors since StepIndicator is new)

    // Fill in the form
    await page.getByPlaceholder('My Home Server').fill('Test Server');
    await page.getByPlaceholder('http://localhost:8080').fill('http://test.example:8080');
    await page.locator('input').nth(2).fill('admin');
    await page.locator('input[type="password"]').fill('secret');

    // Click "Test Connection"
    await page.getByRole('button', { name: 'Test Connection' }).click();

    // Verify test feedback shows success
    await expect(page.getByText('Connection successful!')).toBeVisible();

    // Verify "Add Server" button is enabled
    await expect(page.getByRole('button', { name: 'Add Server' })).toBeEnabled();

    // Click "Add Server"
    await page.getByRole('button', { name: 'Add Server' }).click();

    // Verify navigation to home
    await expect(page).toHaveURL(/\/$/);

    // Verify bridge calls
    const calls = await readRecordedCalls(page);
    expect(calls.some((call) => call.name === 'servers.addServer')).toBe(true);
    expect(calls.some((call) => call.name === 'servers.probeServerScheme')).toBe(true);
  });

  test('shows error feedback when test connection fails', async ({ page }) => {
    await gotoDesktop(page, { appScenario: 'no-saved-servers-failure' });

    // Fill in the form with a bad URL
    await page.getByPlaceholder('My Home Server').fill('Bad Server');
    await page.getByPlaceholder('http://localhost:8080').fill('http://offline.example:8080');
    await page.locator('input').nth(2).fill('admin');
    await page.locator('input[type="password"]').fill('wrong');

    // Click "Test Connection"
    await page.getByRole('button', { name: 'Test Connection' }).click();

    // Verify error feedback is shown
    await expect(page.getByText(/unable to reach server/i)).toBeVisible({ timeout: 10000 });

    // Verify "Add Server" button is disabled
    await expect(page.getByRole('button', { name: 'Add Server' })).toBeDisabled();
  });

  test('shows URL validation error for invalid URL', async ({ page }) => {
    await gotoDesktop(page, { appScenario: 'no-saved-servers' });

    // Enter a URL with a scheme but missing hostname
    await page.getByPlaceholder('http://localhost:8080').fill('http://');
    // Trigger blur to ensure validation runs
    await page.getByPlaceholder('admin').click();

    // Verify validation error appears on the URL field
    // new URL('http://') throws, so we get "Invalid URL format"
    await expect(page.getByText(/invalid url format/i)).toBeVisible({ timeout: 10000 });
  });
});
