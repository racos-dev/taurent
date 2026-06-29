import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  File,
  Filter,
  Folder,
  Gauge,
  Globe,
  HardDrive,
  Layers,
  Link,
  List,
  LogOut,
  Magnet,
  Moon,
  Pause,
  PauseCircle,
  Pencil,
  Play,
  Plus,
  PlusCircle,
  RefreshCw,
  Rss,
  Search,
  Server,
  Settings,
  Shield,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
  XCircle,
  Zap,
  Brush,
  Calendar,
  MessageSquare,
} from './index';
import { RatioIcon, SeedsIcon, SortIcon, ArrowUpDownIcon } from './custom';

export type AppIconName =
  | 'alert'
  | 'arrow-left'
  | 'arrow-right'
  | 'arrow-up-down'
  | 'brush'
  | 'calendar'
  | 'check'
  | 'check-circle'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-up'
  | 'clock'
  | 'download'
  | 'external-link'
  | 'file'
  | 'filter'
  | 'gauge'
  | 'folder'
  | 'globe'
  | 'hard-drive'
  | 'layers'
  | 'link'
  | 'list'
  | 'log-out'
  | 'magnet'
  | 'message'
  | 'moon'
  | 'pause'
  | 'pause-circle'
  | 'pencil'
  | 'play'
  | 'plus'
  | 'plus-circle'
  | 'ratio'
  | 'refresh'
  | 'rss'
  | 'search'
  | 'seeds'
  | 'server'
  | 'settings'
  | 'shield'
  | 'sort'
  | 'tag'
  | 'trash'
  | 'upload'
  | 'users'
  | 'x'
  | 'x-circle'
  | 'zap';

export const CUSTOM_ICONS = {
  CUSTOM_RATIO: RatioIcon,
  CUSTOM_SEEDS: SeedsIcon,
  CUSTOM_SORT: SortIcon,
  CUSTOM_ARROW_UP_DOWN: ArrowUpDownIcon,
} as const;

export type CustomIconKey = keyof typeof CUSTOM_ICONS;

export function isCustomIcon(name: LucideIcon | CustomIconKey): name is CustomIconKey {
  return typeof name === 'string' && name in CUSTOM_ICONS;
}

export const iconMap: Record<AppIconName, LucideIcon | CustomIconKey> = {
  'alert': AlertCircle,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up-down': 'CUSTOM_ARROW_UP_DOWN',
  'brush': Brush,
  'calendar': Calendar,
  'check': Check,
  'check-circle': CheckCircle,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-up': ChevronUp,
  'clock': Clock,
  'download': Download,
  'external-link': ExternalLink,
  'file': File,
  'filter': Filter,
  'gauge': Gauge,
  'folder': Folder,
  'globe': Globe,
  'hard-drive': HardDrive,
  'layers': Layers,
  'link': Link,
  'list': List,
  'log-out': LogOut,
  'magnet': Magnet,
  'message': MessageSquare,
  'moon': Moon,
  'pause': Pause,
  'pause-circle': PauseCircle,
  'pencil': Pencil,
  'play': Play,
  'plus': Plus,
  'plus-circle': PlusCircle,
  'ratio': 'CUSTOM_RATIO',
  'refresh': RefreshCw,
  'rss': Rss,
  'search': Search,
  'seeds': 'CUSTOM_SEEDS',
  'server': Server,
  'settings': Settings,
  'shield': Shield,
  'sort': 'CUSTOM_SORT',
  'tag': Tag,
  'trash': Trash2,
  'upload': Upload,
  'users': Users,
  'x': X,
  'x-circle': XCircle,
  'zap': Zap,
};

export function getIconComponent(name: AppIconName): LucideIcon {
  const icon = iconMap[name];
  if (isCustomIcon(icon)) {
    return CUSTOM_ICONS[icon] as LucideIcon;
  }
  return icon;
}
