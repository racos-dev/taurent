import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LANGUAGE_PREFERENCE_STORAGE_KEY,
  applyLanguagePreference,
  getLanguageState,
  initializeLocalization,
  localization,
  normalizeLocale,
  readLanguagePreference,
  registerCatalogLoader,
  resetLocalizationForTests,
  resolveSystemLocale,
} from './runtime';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  } satisfies Storage;
}

describe('localization runtime', () => {
  beforeEach(() => {
    resetLocalizationForTests();
    vi.stubGlobal('localStorage', createStorage());
    vi.stubGlobal('navigator', { language: 'en-US', languages: ['en-US'] });
    vi.stubGlobal('document', { documentElement: { lang: '', dir: '' } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes supported regional and underscore locale forms', () => {
    expect(normalizeLocale('ro-RO')).toBe('ro');
    expect(normalizeLocale('ro_RO')).toBe('ro');
    expect(normalizeLocale('en-GB')).toBe('en');
    expect(normalizeLocale('de-DE')).toBeNull();
  });

  it('selects the first supported system locale and falls back to English', () => {
    expect(resolveSystemLocale(['de-DE', 'ro-RO'])).toBe('ro');
    expect(resolveSystemLocale(['de-DE'])).toBe('en');
  });

  it('ignores invalid stored preferences', () => {
    localStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, 'de');
    expect(readLanguagePreference()).toBe('system');
  });

  it('initializes from the system locale before rendering', async () => {
    vi.stubGlobal('navigator', { language: 'ro-RO', languages: ['ro-RO'] });
    await initializeLocalization();

    expect(getLanguageState()).toEqual({ preference: 'system', locale: 'ro' });
    expect(localization.t('language.title')).toBe('Limbă');
    expect(document.documentElement.lang).toBe('ro');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('persists an override and uses Romanian plural forms', async () => {
    await initializeLocalization();
    await applyLanguagePreference('ro');

    expect(localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY)).toBe('ro');
    expect(localization.t('selected', { ns: 'torrents', count: 1 })).toBe('1 torrent selectat');
    expect(localization.t('selected', { ns: 'torrents', count: 2 })).toBe('2 torrente selectate');
  });

  it('falls back to English when a lazy catalog cannot be loaded', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    registerCatalogLoader('ro', async () => {
      throw new Error('catalog unavailable');
    });
    try {
      await initializeLocalization();
      await applyLanguagePreference('ro');

      expect(getLanguageState()).toEqual({ preference: 'ro', locale: 'en' });
      expect(localization.t('language.title')).toBe('Language');
      expect(errorSpy).toHaveBeenCalledOnce();
    } finally {
      registerCatalogLoader('ro', async () => {
        const { romanianCatalogs } = await import('./catalogs/ro');
        return { ro: romanianCatalogs };
      });
      errorSpy.mockRestore();
    }
  });
});
