import {
  Download,
  Globe,
  Gauge,
  Link2,
  Shield,
  Settings,
  MonitorCog,
  Palette,
  Info,
  FolderSync,
} from '@taurent/shared';
import { Server as ServerIcon } from '@taurent/shared/icons';
import type { RemoteSettingsSectionKey } from '@taurent/shared/settings';

type SettingsDomain = 'app' | 'qbittorrent';

type AppSection =
  | 'desktop-window'
  | 'desktop-theme'
  | 'desktop-language'
  | 'desktop-about'
  | 'desktop-servers'
  | 'desktop-path-mappings';

type RemoteSection = `remote-${RemoteSettingsSectionKey}`;

export type SectionId = AppSection | RemoteSection;

interface SettingsNavItem {
  id: SectionId;
  domain: SettingsDomain;
  labelKey: string;
  icon: import('react').ComponentType<{ className?: string }>;
  badge?: string;
  remoteSection?: RemoteSettingsSectionKey;
}

export interface SettingsNavGroup {
  id: string;
  label: string;
  items: Array<SettingsNavItem & { label: string }>;
}

export const REMOTE_SECTION_NAV: Array<{
  key: RemoteSettingsSectionKey;
  labelKey: string;
  icon: import('react').ComponentType<{ className?: string }>;
}> = [
  { key: 'downloads', labelKey: 'downloads', icon: Download },
  { key: 'connection', labelKey: 'connection', icon: Globe },
  { key: 'speed', labelKey: 'speed', icon: Gauge },
  { key: 'bittorrent', labelKey: 'bittorrent', icon: Link2 },
  { key: 'webui', labelKey: 'webui', icon: Shield },
  { key: 'advanced', labelKey: 'advanced', icon: Settings },
];

export const APP_NAV_ITEMS: SettingsNavItem[] = [
  { id: 'desktop-window', domain: 'app', labelKey: 'appBehavior', icon: MonitorCog },
  { id: 'desktop-theme', domain: 'app', labelKey: 'theme', icon: Palette },
  { id: 'desktop-language', domain: 'app', labelKey: 'language', icon: Globe },
  { id: 'desktop-about', domain: 'app', labelKey: 'about', icon: Info },
  { id: 'desktop-servers', domain: 'app', labelKey: 'servers', icon: ServerIcon },
  { id: 'desktop-path-mappings', domain: 'app', labelKey: 'pathMappings', icon: FolderSync },
];
