import type { EnglishCatalogs } from './en';
import type { CatalogShape } from './shape';
import { romanianCommon } from './ro/common';
import { romanianAuth } from './ro/auth';
import { romanianTorrents } from './ro/torrents';
import { romanianSettings } from './ro/settings';
import { romanianErrors } from './ro/errors';
import { romanianDialogs } from './ro/dialogs';
import { romanianManagement } from './ro/management';
import { romanianSearch } from './ro/search';
import { romanianRss } from './ro/rss';
import { romanianStatistics } from './ro/statistics';
import { romanianDesktop } from './ro/desktop';
import { romanianMobile } from './ro/mobile';

export const romanianCatalogs = {
  common: romanianCommon,
  auth: romanianAuth,
  torrents: romanianTorrents,
  settings: romanianSettings,
  errors: romanianErrors,
  dialogs: romanianDialogs,
  management: romanianManagement,
  search: romanianSearch,
  rss: romanianRss,
  statistics: romanianStatistics,
  desktop: romanianDesktop,
  mobile: romanianMobile,
} satisfies CatalogShape<EnglishCatalogs>;
