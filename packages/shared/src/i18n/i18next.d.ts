import 'i18next';
import type { EnglishCatalogs } from './catalogs/en';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: EnglishCatalogs;
    returnNull: false;
  }
}

