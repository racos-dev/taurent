import { expect, test } from '@playwright/test';
import { gotoMobile, waitForHomeReady } from './helpers/mobile';

declare global {
  interface Window {
    __TAURENT_TEST_LANGUAGES__?: string[];
  }
}

test.describe('mobile localized torrent journey', () => {
  test('renders the Romanian workspace and torrent details without translating torrent data', async ({ page }) => {
    await gotoMobile(page, { scenario: 'small-100', appScenario: 'connected', language: 'ro' });
    await waitForHomeReady(page);

    await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
    await expect(page.getByRole('button', { name: 'Filtre' })).toBeVisible();
    await page.getByText('Torrent 100', { exact: true }).first().click();

    await expect(page).toHaveURL(/\/torrent\//);
    await expect(page.getByRole('heading', { name: 'Detalii torrent' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Prezentare' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Parteneri' })).toBeVisible();
    await expect(page.getByText('Torrent 100', { exact: true }).first()).toBeVisible();
  });

  test('system language switching preserves pending add-torrent form values', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TAURENT_TEST_LANGUAGES__ = ['en-US'];
      Object.defineProperty(window.navigator, 'languages', {
        configurable: true,
        get: () => window.__TAURENT_TEST_LANGUAGES__,
      });
    });
    await gotoMobile(page, {
      path: '/add-torrent',
      scenario: 'empty',
      appScenario: 'connected',
      language: 'system',
    });

    const magnet = 'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567';
    const input = page.getByPlaceholder('magnet:?xt=urn:btih:...');
    await input.fill(magnet);
    await expect(page.getByRole('heading', { name: 'Add Torrent' })).toBeVisible();

    await page.evaluate(() => {
      window.__TAURENT_TEST_LANGUAGES__ = ['ro-RO'];
      window.dispatchEvent(new Event('languagechange'));
    });

    await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
    await expect(page.getByRole('heading', { name: 'Adaugă torrent' })).toBeVisible();
    await expect(input).toHaveValue(magnet);
    await expect(page.getByText('Opțiuni avansate', { exact: true })).toBeVisible();
  });
});

test.describe('mobile localized settings journey', () => {
  test('rerenders active editors in Romanian while preserving staged control and modal state', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TAURENT_TEST_LANGUAGES__ = ['en-US'];
      Object.defineProperty(window.navigator, 'languages', {
        configurable: true,
        get: () => window.__TAURENT_TEST_LANGUAGES__,
      });
    });
    await gotoMobile(page, {
      path: '/settings',
      scenario: 'empty',
      appScenario: 'connected',
      language: 'system',
    });

    await page.getByRole('button', { name: /BitTorrent/ }).first().click();
    const englishDhtRow = page.getByText(
      'Enable DHT (decentralized network) to find more peers',
      { exact: true },
    ).locator('xpath=ancestor::div[contains(@class,"min-h-16")][1]');
    await englishDhtRow.locator('button[aria-pressed]').click();

    await page.getByRole('button', { name: /Maximum active downloads/ }).click();
    const numberInput = page.getByRole('dialog').locator('input[type="number"]');
    await numberInput.fill('7');

    await page.evaluate(() => {
      window.__TAURENT_TEST_LANGUAGES__ = ['ro-RO'];
      window.dispatchEvent(new Event('languagechange'));
    });

    await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
    await expect(page.getByRole('heading', { name: 'Descărcări maxime' })).toBeVisible();
    await expect(numberInput).toHaveValue('7');
    const romanianDhtRow = page.getByText(
      'Activează DHT (rețea descentralizată) pentru a găsi mai mulți parteneri',
      { exact: true },
    ).locator('xpath=ancestor::div[contains(@class,"min-h-16")][1]');
    await expect(romanianDhtRow.locator('button[aria-pressed]')).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('dialog').getByRole('button', { name: 'Setează', exact: true }).click();

    const encryptionControl = page.getByText('Mod de criptare', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"space-y-2")][1]');
    await encryptionControl.locator('button[aria-haspopup="listbox"]').click();
    await page.getByRole('option', { name: 'Forțează criptarea', exact: true }).click();
    await expect(encryptionControl).toContainText('Forțează criptarea');

    const trackersToggleRow = page.getByText(
      'Adaugă automat aceste trackere descărcărilor noi',
      { exact: true },
    ).locator('xpath=ancestor::div[contains(@class,"min-h-16")][1]');
    const trackersToggle = trackersToggleRow.locator('button[aria-pressed]');
    if (await trackersToggle.getAttribute('aria-pressed') === 'false') {
      await trackersToggle.click();
    }
    const trackersField = page.getByText('Trackere (câte un URL pe linie)', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"space-y-2")][1]')
      .locator('textarea');
    await trackersField.fill('https://tracker.example.test/announce');

    await page.locator('header button').first().click();
    await page.getByRole('button', { name: /Conexiune/ }).first().click();
    const maxConnectionsRow = page.getByText('Număr maxim global de conexiuni', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"min-h-16")][1]');
    const maxConnectionsToggle = maxConnectionsRow.locator('button[aria-pressed]');
    if (await maxConnectionsToggle.getAttribute('aria-pressed') === 'true') {
      await maxConnectionsToggle.click();
    }
    await expect(maxConnectionsRow).toContainText('Nelimitat');
    await expect(page.getByText('Modificări qBittorrent nesalvate', { exact: true })).toBeVisible();
  });
});

test.describe('mobile localized secondary journeys', () => {
  test('renders filters, search, and RSS in Romanian', async ({ page }) => {
    await gotoMobile(page, {
      path: '/filters',
      scenario: 'empty',
      appScenario: 'connected',
      language: 'ro',
    });

    await expect(page.getByRole('heading', { name: 'Filtre' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Stare/ }).first()).toBeVisible();
    await expect(page.getByText('Categorii', { exact: true }).first()).toBeVisible();

    await gotoMobile(page, {
      path: '/search',
      scenario: 'empty',
      appScenario: 'connected',
      language: 'ro',
    });

    await expect(page.getByRole('heading', { name: 'Căutare', exact: true })).toBeVisible();
    await expect(
      page.getByPlaceholder('Caută torrente…')
        .or(page.getByText('Căutarea nu este disponibilă', { exact: true })),
    ).toBeVisible();

    await gotoMobile(page, {
      path: '/rss',
      scenario: 'empty',
      appScenario: 'connected',
      language: 'ro',
    });

    await expect(page.getByRole('heading', { name: 'Fluxuri RSS' })).toBeVisible();
    await expect(page.getByText('0 fluxuri, 0 reguli', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adaugă un flux RSS' })).toBeVisible();
  });
});

test.describe('mobile localized accessibility', () => {
  test('updates the back-button name and supports keyboard activation', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TAURENT_TEST_LANGUAGES__ = ['en-US'];
      Object.defineProperty(window.navigator, 'languages', {
        configurable: true,
        get: () => window.__TAURENT_TEST_LANGUAGES__,
      });
    });
    await gotoMobile(page, {
      path: '/rss',
      scenario: 'empty',
      appScenario: 'connected',
      language: 'system',
    });

    await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
    await page.evaluate(() => {
      window.__TAURENT_TEST_LANGUAGES__ = ['ro-RO'];
      window.dispatchEvent(new Event('languagechange'));
    });

    const back = page.getByRole('button', { name: 'Înapoi', exact: true });
    await expect(back).toBeVisible();
    await back.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/$/);
  });
});
