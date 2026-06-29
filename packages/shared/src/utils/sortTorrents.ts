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
  label: string;
  icon: string;
  defaultOrder: SortOrder;
}[] = [
  { value: 'added_on', label: 'Date Added', icon: 'Calendar', defaultOrder: 'desc' },
  { value: 'name', label: 'Name', icon: 'Text', defaultOrder: 'asc' },
  { value: 'size', label: 'Size', icon: 'HardDrive', defaultOrder: 'desc' },
  { value: 'total_size', label: 'Total Size', icon: 'HardDrive', defaultOrder: 'desc' },
  { value: 'progress', label: 'Progress', icon: 'Target', defaultOrder: 'desc' },
  { value: 'dlspeed', label: 'Download Speed', icon: 'Download', defaultOrder: 'desc' },
  { value: 'upspeed', label: 'Upload Speed', icon: 'Upload', defaultOrder: 'desc' },
  { value: 'ratio', label: 'Ratio', icon: 'BarChart', defaultOrder: 'desc' },
  { value: 'eta', label: 'ETA', icon: 'Clock', defaultOrder: 'asc' },
  { value: 'state', label: 'State', icon: 'Activity', defaultOrder: 'asc' },
  { value: 'category', label: 'Category', icon: 'Folder', defaultOrder: 'asc' },
  { value: 'tags', label: 'Tags', icon: 'Tag', defaultOrder: 'asc' },
  { value: 'tracker', label: 'Tracker', icon: 'Globe', defaultOrder: 'asc' },
  { value: 'downloaded', label: 'Downloaded', icon: 'Download', defaultOrder: 'desc' },
  { value: 'uploaded', label: 'Uploaded', icon: 'Upload', defaultOrder: 'desc' },
  { value: 'downloaded_session', label: 'Session Download', icon: 'Download', defaultOrder: 'desc' },
  { value: 'uploaded_session', label: 'Session Upload', icon: 'Upload', defaultOrder: 'desc' },
  { value: 'num_seeds', label: 'Seeds', icon: 'Users', defaultOrder: 'desc' },
  { value: 'num_leechs', label: 'Peers', icon: 'Users', defaultOrder: 'desc' },
  { value: 'num_complete', label: 'Seeds (Total)', icon: 'Users', defaultOrder: 'desc' },
  { value: 'num_incomplete', label: 'Peers (Total)', icon: 'Users', defaultOrder: 'desc' },
  { value: 'priority', label: 'Priority', icon: 'Star', defaultOrder: 'desc' },
  { value: 'time_active', label: 'Time Active', icon: 'Clock', defaultOrder: 'desc' },
  { value: 'seeding_time', label: 'Seeding Time', icon: 'Clock', defaultOrder: 'desc' },
  { value: 'completion_on', label: 'Completed On', icon: 'CheckCircle', defaultOrder: 'desc' },
  { value: 'last_activity', label: 'Last Activity', icon: 'Activity', defaultOrder: 'desc' },
  { value: 'force_start', label: 'Force Start', icon: 'Play', defaultOrder: 'desc' },
  { value: 'amount_left', label: 'Remaining', icon: 'HardDrive', defaultOrder: 'asc' },
  { value: 'completed', label: 'Completed', icon: 'CheckCircle', defaultOrder: 'desc' },
  { value: 'availability', label: 'Availability', icon: 'Signal', defaultOrder: 'desc' },
  { value: 'ratio_limit', label: 'Ratio Limit', icon: 'BarChart', defaultOrder: 'desc' },
  { value: 'seen_complete', label: 'Last Seen Complete', icon: 'Eye', defaultOrder: 'desc' },
  { value: 'save_path', label: 'Save Path', icon: 'Folder', defaultOrder: 'asc' },
  { value: 'dl_limit', label: 'Down Limit', icon: 'Download', defaultOrder: 'desc' },
  { value: 'up_limit', label: 'Up Limit', icon: 'Upload', defaultOrder: 'desc' },
  { value: 'popularity', label: 'Popularity', icon: 'TrendingUp', defaultOrder: 'desc' },
];

export function isValidSortField(value: string): value is SortField {
  return ALL_SORT_FIELDS.includes(value as SortField);
}
