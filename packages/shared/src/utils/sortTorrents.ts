import type { Torrent } from '../types/qbittorrent';
import { measure } from './perfAudit';

export type SortOrder = 'asc' | 'desc';

export type SortField =
  | 'added_on'
  | 'amount_left'
  | 'availability'
  | 'category'
  | 'completed'
  | 'completion_on'
  | 'dl_limit'
  | 'downloaded'
  | 'downloaded_session'
  | 'dlspeed'
  | 'eta'
  | 'force_start'
  | 'last_activity'
  | 'name'
  | 'num_complete'
  | 'num_incomplete'
  | 'num_leechs'
  | 'num_seeds'
  | 'popularity'
  | 'priority'
  | 'progress'
  | 'ratio'
  | 'ratio_limit'
  | 'save_path'
  | 'seeding_time'
  | 'seen_complete'
  | 'size'
  | 'state'
  | 'tags'
  | 'time_active'
  | 'total_size'
  | 'tracker'
  | 'up_limit'
  | 'uploaded'
  | 'uploaded_session'
  | 'upspeed';

export interface SortConfig {
  sortBy: SortField;
  sortOrder: SortOrder;
}

export function sortTorrents(torrents: Torrent[], sortBy: SortField, sortOrder: SortOrder): Torrent[] {
  return measure(`sortTorrents.${sortBy}`, () => {
    const sorted = [...torrents].sort((a, b) => {
      let valueA: number | string | boolean;
      let valueB: number | string | boolean;

      switch (sortBy) {
        case 'added_on':
          valueA = a.added_on || 0;
          valueB = b.added_on || 0;
          break;
        case 'amount_left':
          valueA = a.amount_left || 0;
          valueB = b.amount_left || 0;
          break;
        case 'availability':
          valueA = a.availability >= 0 ? a.availability : -Infinity;
          valueB = b.availability >= 0 ? b.availability : -Infinity;
          break;
        case 'category':
          valueA = a.category || '';
          valueB = b.category || '';
          break;
        case 'completed':
          valueA = a.completed || 0;
          valueB = b.completed || 0;
          break;
        case 'completion_on':
          valueA = a.completion_on || 0;
          valueB = b.completion_on || 0;
          break;
        case 'dl_limit':
          valueA = a.dl_limit || 0;
          valueB = b.dl_limit || 0;
          break;
        case 'downloaded':
          valueA = a.downloaded || 0;
          valueB = b.downloaded || 0;
          break;
        case 'downloaded_session':
          valueA = a.downloaded_session || 0;
          valueB = b.downloaded_session || 0;
          break;
        case 'dlspeed':
          valueA = a.dlspeed || 0;
          valueB = b.dlspeed || 0;
          break;
        case 'eta':
          valueA = a.eta >= 0 ? a.eta : Infinity;
          valueB = b.eta >= 0 ? b.eta : Infinity;
          break;
        case 'force_start':
          valueA = a.force_start ? 1 : 0;
          valueB = b.force_start ? 1 : 0;
          break;
        case 'last_activity':
          valueA = a.last_activity || 0;
          valueB = b.last_activity || 0;
          break;
        case 'name':
          valueA = a.name || '';
          valueB = b.name || '';
          break;
        case 'num_complete':
          valueA = a.num_complete ?? -1;
          valueB = b.num_complete ?? -1;
          break;
        case 'num_incomplete':
          valueA = a.num_incomplete ?? -1;
          valueB = b.num_incomplete ?? -1;
          break;
        case 'num_leechs':
          valueA = a.num_leechs || 0;
          valueB = b.num_leechs || 0;
          break;
        case 'num_seeds':
          valueA = a.num_seeds || 0;
          valueB = b.num_seeds || 0;
          break;
        case 'popularity':
          valueA = a.popularity ?? -Infinity;
          valueB = b.popularity ?? -Infinity;
          break;
        case 'priority':
          valueA = a.priority || 0;
          valueB = b.priority || 0;
          break;
        case 'progress':
          valueA = a.progress || 0;
          valueB = b.progress || 0;
          break;
        case 'ratio':
          valueA = a.ratio >= 0 ? a.ratio : -Infinity;
          valueB = b.ratio >= 0 ? b.ratio : -Infinity;
          break;
        case 'ratio_limit':
          valueA = a.ratio_limit >= 0 ? a.ratio_limit : -Infinity;
          valueB = b.ratio_limit >= 0 ? b.ratio_limit : -Infinity;
          break;
        case 'save_path':
          valueA = a.save_path || '';
          valueB = b.save_path || '';
          break;
        case 'seeding_time':
          valueA = a.seeding_time || 0;
          valueB = b.seeding_time || 0;
          break;
        case 'seen_complete':
          valueA = a.seen_complete || 0;
          valueB = b.seen_complete || 0;
          break;
        case 'size':
          valueA = a.size || 0;
          valueB = b.size || 0;
          break;
        case 'state':
          valueA = a.state || '';
          valueB = b.state || '';
          break;
        case 'tags':
          valueA = a.tags || '';
          valueB = b.tags || '';
          break;
        case 'time_active':
          valueA = a.time_active || 0;
          valueB = b.time_active || 0;
          break;
        case 'total_size':
          valueA = a.total_size || 0;
          valueB = b.total_size || 0;
          break;
        case 'tracker':
          valueA = a.tracker || '';
          valueB = b.tracker || '';
          break;
        case 'up_limit':
          valueA = a.up_limit || 0;
          valueB = b.up_limit || 0;
          break;
        case 'uploaded':
          valueA = a.uploaded || 0;
          valueB = b.uploaded || 0;
          break;
        case 'uploaded_session':
          valueA = a.uploaded_session || 0;
          valueB = b.uploaded_session || 0;
          break;
        case 'upspeed':
          valueA = a.upspeed || 0;
          valueB = b.upspeed || 0;
          break;
        default:
          valueA = a.added_on || 0;
          valueB = b.added_on || 0;
          break;
      }

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortOrder === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }

      if (typeof valueA === 'boolean' && typeof valueB === 'boolean') {
        return sortOrder === 'asc'
          ? (valueA === valueB ? 0 : valueA ? 1 : -1)
          : (valueA === valueB ? 0 : valueA ? -1 : 1);
      }

      if (sortOrder === 'asc') {
        return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      } else {
        return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
      }
    });

    return sorted;
  });
}

const ALL_SORT_FIELDS: SortField[] = [
  'added_on',
  'amount_left',
  'availability',
  'category',
  'completed',
  'completion_on',
  'dl_limit',
  'downloaded',
  'downloaded_session',
  'dlspeed',
  'eta',
  'force_start',
  'last_activity',
  'name',
  'num_complete',
  'num_incomplete',
  'num_leechs',
  'num_seeds',
  'popularity',
  'priority',
  'progress',
  'ratio',
  'ratio_limit',
  'save_path',
  'seeding_time',
  'seen_complete',
  'size',
  'state',
  'tags',
  'time_active',
  'total_size',
  'tracker',
  'up_limit',
  'uploaded',
  'uploaded_session',
  'upspeed',
];

export const SORT_OPTIONS: {
  value: SortField;
  labelKey: `sort.${string}`;
  icon: string;
  defaultOrder: SortOrder;
}[] = [
  { value: 'added_on', labelKey: 'sort.dateAdded', icon: 'Calendar', defaultOrder: 'desc' },
  { value: 'name', labelKey: 'sort.name', icon: 'Text', defaultOrder: 'asc' },
  { value: 'size', labelKey: 'sort.size', icon: 'HardDrive', defaultOrder: 'desc' },
  { value: 'total_size', labelKey: 'sort.totalSize', icon: 'HardDrive', defaultOrder: 'desc' },
  { value: 'progress', labelKey: 'sort.progress', icon: 'Target', defaultOrder: 'desc' },
  { value: 'dlspeed', labelKey: 'sort.downloadSpeed', icon: 'Download', defaultOrder: 'desc' },
  { value: 'upspeed', labelKey: 'sort.uploadSpeed', icon: 'Upload', defaultOrder: 'desc' },
  { value: 'ratio', labelKey: 'sort.ratio', icon: 'BarChart', defaultOrder: 'desc' },
  { value: 'eta', labelKey: 'sort.eta', icon: 'Clock', defaultOrder: 'asc' },
  { value: 'state', labelKey: 'sort.state', icon: 'Activity', defaultOrder: 'asc' },
  { value: 'category', labelKey: 'sort.category', icon: 'Folder', defaultOrder: 'asc' },
  { value: 'tags', labelKey: 'sort.tags', icon: 'Tag', defaultOrder: 'asc' },
  { value: 'tracker', labelKey: 'sort.tracker', icon: 'Globe', defaultOrder: 'asc' },
  { value: 'downloaded', labelKey: 'sort.downloaded', icon: 'Download', defaultOrder: 'desc' },
  { value: 'uploaded', labelKey: 'sort.uploaded', icon: 'Upload', defaultOrder: 'desc' },
  { value: 'downloaded_session', labelKey: 'sort.sessionDownload', icon: 'Download', defaultOrder: 'desc' },
  { value: 'uploaded_session', labelKey: 'sort.sessionUpload', icon: 'Upload', defaultOrder: 'desc' },
  { value: 'num_seeds', labelKey: 'sort.seeds', icon: 'Users', defaultOrder: 'desc' },
  { value: 'num_leechs', labelKey: 'sort.peers', icon: 'Users', defaultOrder: 'desc' },
  { value: 'num_complete', labelKey: 'sort.seedsTotal', icon: 'Users', defaultOrder: 'desc' },
  { value: 'num_incomplete', labelKey: 'sort.peersTotal', icon: 'Users', defaultOrder: 'desc' },
  { value: 'priority', labelKey: 'sort.priority', icon: 'Star', defaultOrder: 'desc' },
  { value: 'time_active', labelKey: 'sort.timeActive', icon: 'Clock', defaultOrder: 'desc' },
  { value: 'seeding_time', labelKey: 'sort.seedingTime', icon: 'Clock', defaultOrder: 'desc' },
  { value: 'completion_on', labelKey: 'sort.completedOn', icon: 'CheckCircle', defaultOrder: 'desc' },
  { value: 'last_activity', labelKey: 'sort.lastActivity', icon: 'Activity', defaultOrder: 'desc' },
  { value: 'force_start', labelKey: 'sort.forceStart', icon: 'Play', defaultOrder: 'desc' },
  { value: 'amount_left', labelKey: 'sort.remaining', icon: 'HardDrive', defaultOrder: 'asc' },
  { value: 'completed', labelKey: 'sort.completed', icon: 'CheckCircle', defaultOrder: 'desc' },
  { value: 'availability', labelKey: 'sort.availability', icon: 'Signal', defaultOrder: 'desc' },
  { value: 'ratio_limit', labelKey: 'sort.ratioLimit', icon: 'BarChart', defaultOrder: 'desc' },
  { value: 'seen_complete', labelKey: 'sort.lastSeenComplete', icon: 'Eye', defaultOrder: 'desc' },
  { value: 'save_path', labelKey: 'sort.savePath', icon: 'Folder', defaultOrder: 'asc' },
  { value: 'dl_limit', labelKey: 'sort.downloadLimit', icon: 'Download', defaultOrder: 'desc' },
  { value: 'up_limit', labelKey: 'sort.uploadLimit', icon: 'Upload', defaultOrder: 'desc' },
  { value: 'popularity', labelKey: 'sort.popularity', icon: 'TrendingUp', defaultOrder: 'desc' },
];

export function getDefaultSortOrder(field: SortField): SortOrder {
  return SORT_OPTIONS.find((option) => option.value === field)?.defaultOrder ?? 'asc';
}

export function isValidSortField(value: string): value is SortField {
  return ALL_SORT_FIELDS.includes(value as SortField);
}
