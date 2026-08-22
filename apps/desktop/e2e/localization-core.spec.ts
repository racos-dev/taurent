import { expect, test } from '@playwright/test';
import {
  emitMockLanguageChanged,
  getFirstVisibleTorrentRow,
  gotoDesktop,
  readTorrentRowName,
  waitForHomeReady,
} from './helpers/desktop';

test.describe('desktop localized torrent journey', () => {
  test('renders the Romanian workspace and detail pane without translating torrent data', async ({ page }) => {
    await gotoDesktop(page, { scenario: 'small-100', appScenario: 'connected', language: 'ro' });
    await waitForHomeReady(page);

    await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
    await expect(page.getByText('Stare', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Toate categoriile' })).toBeVisible();

    const row = getFirstVisibleTorrentRow(page);
    const torrentName = await readTorrentRowName(row);
    expect(torrentName).not.toBeNull();
    await page.getByRole('cell', { name: torrentName!, exact: true }).click();

    await expect(page.getByRole('button', { name: 'Închide panoul de proprietăți' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'General' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Parteneri' })).toBeVisible();
    await expect(page.getByText(torrentName!, { exact: true }).first()).toBeVisible();
  });

  test('runtime switching preserves the active filter, selected torrent, and detail tab', async ({ page }) => {
    await gotoDesktop(page, { scenario: 'small-100', appScenario: 'connected', language: 'en' });
    await waitForHomeReady(page);

    const search = page.getByRole('textbox', { name: 'Filter torrents…' });
    await search.fill('Torrent 100');
    await page.getByRole('cell', { name: 'Torrent 100', exact: true }).click();
    await page.getByRole('tab', { name: 'Content' }).click();

    await page.evaluate(() => window.__TAURENT_TAURI_EVENTS__?.clearEmittedEvents());

    await emitMockLanguageChanged(page, {
      preference: 'ro',
      resolved_locale: 'ro',
    });

    await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
    await expect(page.getByRole('textbox', { name: 'Filtrează torrentele…' })).toHaveValue('Torrent 100');
    await expect(page.getByRole('button', { name: 'Închide panoul de proprietăți' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Conținut' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('cell', { name: 'Torrent 100', exact: true })).toBeVisible();
    await expect.poll(async () => {
      const events = await page.evaluate(() => window.__TAURENT_TAURI_EVENTS__?.getEmittedEvents() ?? []);
      return events.filter((event) => event.event === 'language-changed').length;
    }).toBe(0);
  });
});

test.describe('desktop localized settings journey', () => {
  test('keeps staged boolean, numeric, select, text, conditional, and unlimited controls across a language switch', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/settings-window?section=remote-connection',
      scenario: 'empty',
      appScenario: 'connected',
      language: 'ro',
    });

    await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
    await expect(page.getByRole('heading', { name: 'Setări', exact: true }).last()).toBeVisible();
    await expect(page.getByText('Port folosit pentru conexiunile primite', { exact: true })).toBeVisible();

    const listenPort = page.locator('#field-listen_port');
    await listenPort.fill('4242');

    const proxyType = page.locator('#field-proxy_type');
    await proxyType.click();
    await page.getByRole('option', { name: 'HTTP', exact: true }).click();
    const proxyHost = page.locator('#field-proxy_ip');
    await expect(proxyHost).toBeVisible();
    await proxyHost.fill('proxy.example.test');

    const portForwarding = page.getByTestId('settings-checkbox-upnp');
    const initialPortForwardingState = await portForwarding.getAttribute('aria-checked');
    await portForwarding.click();
    await expect(portForwarding).toHaveAttribute('aria-checked', initialPortForwardingState === 'true' ? 'false' : 'true');

    const unlimitedConnections = page.getByTestId('settings-checkbox-max_connec');
    await unlimitedConnections.click();
    await expect(page.getByText('Nelimitat', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Modificări nesalvate', { exact: true })).toBeVisible();

    await emitMockLanguageChanged(page, { preference: 'en', resolved_locale: 'en' });

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByText('Port used for incoming connections', { exact: true })).toBeVisible();
    await expect(listenPort).toHaveValue('4242');
    await expect(proxyHost).toHaveValue('proxy.example.test');
    await expect(proxyType).toContainText('HTTP');
    await expect(page.getByText('Unlimited', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
  });
});

test.describe('desktop localized secondary journeys', () => {
  test('renders management filters in Romanian', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/filters',
      scenario: 'empty',
      appScenario: 'connected',
      language: 'ro',
    });

    await expect(page.getByRole('heading', { name: 'Filtre' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Stare', exact: true })).toBeVisible();
    await expect(page.getByText('Categorii', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Trackere', { exact: true }).first()).toBeVisible();
  });

  test('renders search and RSS capability surfaces in Romanian', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/search',
      scenario: 'empty',
      appScenario: 'connected',
      language: 'ro',
    });

    await expect(page.getByPlaceholder('Caută torrente…')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Caută', exact: true })).toBeVisible();

    await gotoDesktop(page, {
      path: '/rss',
      scenario: 'empty',
      appScenario: 'connected',
      language: 'ro',
    });

    await expect(page.getByRole('button', { name: 'Adaugă un flux RSS' })).toBeVisible();
    await expect(page.getByText('Fluxuri (0)', { exact: true })).toBeVisible();
    await expect(page.getByText('Nu este configurat niciun flux RSS', { exact: true })).toBeVisible();
  });

  test('renders statistics and a route-hosted dialog in Romanian', async ({ page }) => {
    await gotoDesktop(page, {
      path: '/statistics-window',
      scenario: 'empty',
      appScenario: 'saved-server-disconnected',
      language: 'ro',
    });

    await expect(page.getByText('Neconectat', { exact: true })).toBeVisible();
    await expect(page.getByText('Conectează-te la un server qBittorrent pentru a vedea statisticile.')).toBeVisible();

    await gotoDesktop(page, {
      path: '/dialog-host-window?dialog=confirm&openId=1',
      scenario: 'empty',
      appScenario: 'connected',
      language: 'ro',
      searchParams: { name: 'videos', type: 'category' },
    });

    await expect(page.getByText('Ștergi „videos”?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anulează', exact: true })).toBeVisible();
  });
});

test.describe('desktop localized shell accessibility', () => {
  test('updates accessible menubar names and keeps keyboard navigation working', async ({ page }) => {
    await gotoDesktop(page, {
      scenario: 'empty',
      appScenario: 'connected',
      language: 'en',
    });
    await waitForHomeReady(page);

    const menuToggle = page.getByTestId('toolbar-toggle-menubar');
    if (await menuToggle.isVisible()) {
      await menuToggle.click();
    }
    await expect(page.getByRole('menubar', { name: 'Application menu' })).toBeVisible();
    await page.getByTestId('menu-file').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Add Torrent…', { exact: true })).toBeVisible();

    await emitMockLanguageChanged(page, { preference: 'ro', resolved_locale: 'ro' });
    await expect(page.getByRole('menubar', { name: 'Meniul aplicației' })).toBeVisible();
    await expect(page.getByText('Adaugă torrent…', { exact: true })).toBeVisible();
    await page.getByRole('menu').focus();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Adaugă torrent…', { exact: true })).not.toBeVisible();
  });

  test('renders the updater workflow in Romanian', async ({ page }) => {
    await gotoDesktop(page, {
      scenario: 'empty',
      appScenario: 'connected',
      language: 'ro',
      searchParams: { mockUpdate: 'available' },
    });
    await waitForHomeReady(page);

    await expect(page.getByText('Taurent v1.1.0 este disponibil', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Vezi versiunea', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Actualizează', exact: true }).click();
    await expect(page.getByText('Actualizare instalată', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Repornește', exact: true })).toBeVisible();
  });
});
