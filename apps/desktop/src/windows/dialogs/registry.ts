import type { DialogWindowConfig } from './dialogHostWindow';
import { CategorySelectDialogScreen } from '../../screens/CategorySelectDialogScreen';
import { ConfirmDialogScreen } from '../../screens/ConfirmDialogScreen';
import { CreateDialogScreen } from '../../screens/CreateDialogScreen';
import { EditCategoryDialogScreen } from '../../screens/EditCategoryDialogScreen';
import { TagSelectDialogScreen } from '../../screens/TagSelectDialogScreen';
import { ServerDeleteDialogScreen } from '../../screens/ServerDeleteDialogScreen';
import { TorrentDeleteDialogScreen } from '../../screens/TorrentDeleteDialogScreen';
import { TorrentNumericDialogScreen } from '../../screens/TorrentNumericDialogScreen';
import { TorrentShareLimitsDialogScreen } from '../../screens/TorrentShareLimitsDialogScreen';
import { TorrentTextDialogScreen } from '../../screens/TorrentTextDialogScreen';
import { TransferLimitDialogScreen } from '../../screens/TransferLimitDialogScreen';
import { CATEGORY_SELECT_DIALOG_WINDOW_CONFIG } from './categorySelectDialogWindow';
import { CONFIRM_DIALOG_WINDOW_CONFIG } from './confirmDialogWindow';
import { CREATE_DIALOG_WINDOW_CONFIG } from './createDialogWindow';
import { EDIT_CATEGORY_DIALOG_WINDOW_CONFIG } from './editCategoryDialogWindow';
import { TAG_SELECT_DIALOG_WINDOW_CONFIG } from './tagSelectDialogWindow';
import { SERVER_DELETE_DIALOG_WINDOW_CONFIG } from './serverDeleteDialogWindow';
import { TORRENT_DELETE_DIALOG_WINDOW_CONFIG } from './torrentDeleteDialogWindow';
import { TORRENT_NUMERIC_DIALOG_WINDOW_CONFIG } from './torrentNumericDialogWindow';
import { TORRENT_SHARE_LIMITS_DIALOG_WINDOW_CONFIG } from './torrentShareLimitsDialogWindow';
import { TORRENT_TEXT_DIALOG_WINDOW_CONFIG } from './torrentTextDialogWindow';
import { TRANSFER_LIMIT_DIALOG_WINDOW_CONFIG } from './transferLimitDialogWindow';

export const DESKTOP_DIALOGS = {
  'category-select': {
    config: CATEGORY_SELECT_DIALOG_WINDOW_CONFIG,
    Screen: CategorySelectDialogScreen,
  },
  confirm: {
    config: CONFIRM_DIALOG_WINDOW_CONFIG,
    Screen: ConfirmDialogScreen,
  },
  create: {
    config: CREATE_DIALOG_WINDOW_CONFIG,
    Screen: CreateDialogScreen,
  },
  'edit-category': {
    config: EDIT_CATEGORY_DIALOG_WINDOW_CONFIG,
    Screen: EditCategoryDialogScreen,
  },
  'tag-select': {
    config: TAG_SELECT_DIALOG_WINDOW_CONFIG,
    Screen: TagSelectDialogScreen,
  },
  'server-delete': {
    config: SERVER_DELETE_DIALOG_WINDOW_CONFIG,
    Screen: ServerDeleteDialogScreen,
  },
  'torrent-delete': {
    config: TORRENT_DELETE_DIALOG_WINDOW_CONFIG,
    Screen: TorrentDeleteDialogScreen,
  },
  'torrent-numeric': {
    config: TORRENT_NUMERIC_DIALOG_WINDOW_CONFIG,
    Screen: TorrentNumericDialogScreen,
  },
  'torrent-share-limits': {
    config: TORRENT_SHARE_LIMITS_DIALOG_WINDOW_CONFIG,
    Screen: TorrentShareLimitsDialogScreen,
  },
  'torrent-text': {
    config: TORRENT_TEXT_DIALOG_WINDOW_CONFIG,
    Screen: TorrentTextDialogScreen,
  },
  'transfer-limit': {
    config: TRANSFER_LIMIT_DIALOG_WINDOW_CONFIG,
    Screen: TransferLimitDialogScreen,
  },
} as const satisfies Record<string, { config: DialogWindowConfig; Screen: React.ComponentType }>;

export type DialogHostKind = keyof typeof DESKTOP_DIALOGS;
export const DIALOG_HOST_KINDS = Object.keys(DESKTOP_DIALOGS) as DialogHostKind[];
