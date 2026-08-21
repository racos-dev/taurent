import { createInstance, type Resource, type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { englishCatalogs } from './catalogs/en';
import type { AppNamespace, LanguagePreference, LanguageState, SupportedLocale } from './types';

export const LANGUAGE_PREFERENCE_STORAGE_KEY = 'taurent_language_preference';

const DEFAULT_LOCALE: SupportedLocale = 'en';
const namespaces = Object.keys(englishCatalogs) as AppNamespace[];
const listeners = new Set<() => void>();

type CatalogLoader = () => Promise<Resource>;

const localeLoaders: Record<Exclude<SupportedLocale, 'en'>, CatalogLoader> = {
  ro: async () => {
    const { romanianCatalogs } = await import('./catalogs/ro');
    return { ro: romanianCatalogs };
  },
};

export function registerCatalogLoader(
  locale: Exclude<SupportedLocale, 'en'>,
  loader: CatalogLoader,
): void {
  localeLoaders[locale] = loader;
  loadedLocales.delete(locale);
}

export const localization: i18n = createInstance();

let languageState: LanguageState = { preference: 'system', locale: DEFAULT_LOCALE };
let initialization: Promise<void> | null = null;
const loadedLocales = new Set<SupportedLocale>(['en']);

function emitStateChange(): void {
  for (const listener of listeners) listener();
}

export function subscribeLanguageState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLanguageState(): LanguageState {
  return languageState;
}

export function normalizeLocale(value: string | null | undefined): SupportedLocale | null {
  if (!value) return null;
  const normalized = value.trim().replace(/_/g, '-').toLowerCase();
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  if (normalized === 'ro' || normalized.startsWith('ro-')) return 'ro';
  return null;
}

export function resolveSystemLocale(languages?: readonly string[]): SupportedLocale {
  let browserLanguages: readonly string[] = [];
  if (typeof navigator !== 'undefined') {
    browserLanguages = navigator.languages?.length
      ? navigator.languages
      : [navigator.language];
  }
  const candidates = languages ?? browserLanguages;
  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}

export function resolveLanguagePreference(preference: LanguagePreference): SupportedLocale {
  return preference === 'system' ? resolveSystemLocale() : preference;
}

export function readLanguagePreference(): LanguagePreference {
  if (typeof localStorage === 'undefined') return 'system';
  try {
    const saved = localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY);
    if (saved === 'system' || saved === 'en' || saved === 'ro') return saved;
  } catch {
    // Storage is best-effort; use the system preference when unavailable.
  }
  return 'system';
}

function persistLanguagePreference(preference: LanguagePreference): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, preference);
  } catch (error) {
    console.warn('[i18n] Failed to persist language preference:', error);
  }
}

function applyDocumentLocale(locale: SupportedLocale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.dir = localization.dir(locale);
}

async function ensureLocale(locale: SupportedLocale): Promise<void> {
  if (loadedLocales.has(locale)) return;
  const loader = localeLoaders[locale as Exclude<SupportedLocale, 'en'>];
  if (!loader) return;
  const resources = await loader();
  const localeResources = resources[locale];
  if (!localeResources) throw new Error(`Localization resources missing for ${locale}`);
  for (const namespace of namespaces) {
    const bundle = localeResources[namespace];
    if (bundle) localization.addResourceBundle(locale, namespace, bundle, true, true);
  }
  loadedLocales.add(locale);
}

async function initializeBase(): Promise<void> {
  if (localization.isInitialized) return;
  await localization.use(initReactI18next).init({
    resources: { en: englishCatalogs },
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALE_VALUES],
    load: 'currentOnly',
    ns: namespaces,
    defaultNS: 'common',
    initAsync: false,
    returnNull: false,
    returnEmptyString: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

const SUPPORTED_LOCALE_VALUES: readonly SupportedLocale[] = ['en', 'ro'];

// Install the eager English catalog synchronously so isolated components and
// tests can translate safely even before an app bootstrap selects a locale.
void initializeBase();

export async function initializeLocalization(): Promise<void> {
  if (initialization) return initialization;
  initialization = (async () => {
    await initializeBase();
    const preference = readLanguagePreference();
    const locale = resolveLanguagePreference(preference);
    try {
      await ensureLocale(locale);
      await localization.changeLanguage(locale);
      languageState = { preference, locale };
    } catch (error) {
      console.error(`[i18n] Failed to initialize locale ${locale}; using English.`, error);
      await localization.changeLanguage(DEFAULT_LOCALE);
      languageState = { preference, locale: DEFAULT_LOCALE };
    }
    applyDocumentLocale(languageState.locale);
    emitStateChange();
  })();
  return initialization;
}

export interface ApplyLanguagePreferenceOptions {
  persist?: boolean;
  resolvedLocale?: SupportedLocale;
}

export async function applyLanguagePreference(
  preference: LanguagePreference,
  options: ApplyLanguagePreferenceOptions = {},
): Promise<LanguageState> {
  await initializeLocalization();
  const locale = options.resolvedLocale ?? resolveLanguagePreference(preference);
  try {
    await ensureLocale(locale);
    await localization.changeLanguage(locale);
    languageState = { preference, locale };
  } catch (error) {
    console.error(`[i18n] Failed to load locale ${locale}; using English.`, error);
    await localization.changeLanguage(DEFAULT_LOCALE);
    languageState = { preference, locale: DEFAULT_LOCALE };
  }
  if (options.persist !== false) persistLanguagePreference(preference);
  applyDocumentLocale(languageState.locale);
  emitStateChange();
  return languageState;
}

export async function refreshSystemLanguage(): Promise<LanguageState> {
  if (languageState.preference !== 'system') return languageState;
  return applyLanguagePreference('system', { persist: false });
}

export function resetLocalizationForTests(): void {
  languageState = { preference: 'system', locale: DEFAULT_LOCALE };
  initialization = null;
  loadedLocales.clear();
  loadedLocales.add('en');
  if (
    typeof localization.hasResourceBundle === 'function'
    && localization.hasResourceBundle('ro', 'common')
  ) {
    loadedLocales.add('ro');
  }
}
