import type { TFunction } from 'i18next';
import type { EnglishCatalogs } from './catalogs/en';

export const SUPPORTED_LOCALES = ['en', 'ro'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type LanguagePreference = 'system' | SupportedLocale;
export type AppNamespace = keyof EnglishCatalogs;
export type CatalogResources = EnglishCatalogs;
export type TaurentTFunction = TFunction;

export interface LanguageState {
  preference: LanguagePreference;
  locale: SupportedLocale;
}

export interface LocalizationContextValue extends LanguageState {
  t: TaurentTFunction;
  isChanging: boolean;
  setPreference: (preference: LanguagePreference) => Promise<void>;
}
