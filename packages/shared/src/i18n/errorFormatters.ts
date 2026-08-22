import { useMemo } from 'react';
import type { TFunction } from 'i18next';
import {
  classifyError,
  type ErrorCategory,
  type ErrorMessageContext,
} from '../utils/error';
import { useTaurentTranslation } from './LocalizationProvider';

const CATEGORY_KEYS = {
  auth: 'auth',
  network: 'network',
  http: 'http',
  conflict: 'conflict',
  parse: 'response',
  'invalid-response': 'response',
} as const satisfies Record<Exclude<ErrorCategory, 'unknown'>, string>;

const CONTEXT_KEYS = {
  'add-server': 'addServer',
  'add-torrent': 'addTorrent',
  'app-settings': 'appSettings',
  connection: 'connection',
  'file-picker': 'filePicker',
  'native-menu': 'nativeMenu',
  'path-mappings': 'pathMappings',
  rss: 'rss',
  search: 'search',
  'server-switch': 'serverSwitch',
  'settings-load': 'settingsLoad',
  'settings-save': 'settingsSave',
  'speed-limits': 'speedLimits',
  'torrent-action': 'torrentAction',
} as const satisfies Record<ErrorMessageContext, string>;

/**
 * Creates a formatter for translated, stable error summaries. Raw backend
 * messages remain available to callers as diagnostic data, but are never used
 * as the localized summary returned here.
 */
export function createLocalizedErrorFormatter(t: TFunction<'errors'>) {
  return (error: unknown, context?: ErrorMessageContext): string => {
    const category = classifyError(error);
    const key = category === 'unknown'
      ? context ? CONTEXT_KEYS[context] : 'unknown'
      : CATEGORY_KEYS[category];
    return t(key);
  };
}

export function useLocalizedErrorFormatter() {
  const { t } = useTaurentTranslation('errors');
  return useMemo(() => createLocalizedErrorFormatter(t), [t]);
}
