import { englishCommon } from './en/common';
import { englishAuth } from './en/auth';
import { englishTorrents } from './en/torrents';
import { englishSettings } from './en/settings';
import { englishErrors } from './en/errors';
import { englishDialogs } from './en/dialogs';
import { englishManagement } from './en/management';
import { englishSearch } from './en/search';
import { englishRss } from './en/rss';
import { englishStatistics } from './en/statistics';
import { englishDesktop } from './en/desktop';
import { englishMobile } from './en/mobile';

export const englishCatalogs = {
  common: englishCommon,
  auth: englishAuth,
  torrents: englishTorrents,
  settings: englishSettings,
  errors: englishErrors,
  dialogs: englishDialogs,
  management: englishManagement,
  search: englishSearch,
  rss: englishRss,
  statistics: englishStatistics,
  desktop: englishDesktop,
  mobile: englishMobile,
} as const;

export type EnglishCatalogs = typeof englishCatalogs;
