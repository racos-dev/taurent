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
  | 'desktop-about'
  | 'desktop-servers'
  | 'desktop-path-mappings';

type RemoteSection = `remote-${RemoteSettingsSectionKey}`;

export type SectionId = AppSection | RemoteSection;

interface SettingsNavItem {
  id: SectionId;
  domain: SettingsDomain;
  label: string;
  icon: import('react').ComponentType<{ className?: string }>;
  badge?: string;
  remoteSection?: RemoteSettingsSectionKey;
}

export interface SettingsNavGroup {
  id: string;
  label: string;
  items: SettingsNavItem[];
}

export const REMOTE_SECTION_NAV: Array<{
  key: RemoteSettingsSectionKey;
  label: string;
  icon: import('react').ComponentType<{ className?: string }>;
}> = [
  { key: 'downloads', label: 'Downloads', icon: Download },
  { key: 'connection', label: 'Connection', icon: Globe },
  { key: 'speed', label: 'Speed', icon: Gauge },
  { key: 'bittorrent', label: 'BitTorrent', icon: Link2 },
  { key: 'webui', label: 'WebUI', icon: Shield },
  { key: 'advanced', label: 'Advanced', icon: Settings },
];

export const APP_NAV_ITEMS: SettingsNavItem[] = [
  { id: 'desktop-window', domain: 'app', label: 'App Behavior', icon: MonitorCog },
  { id: 'desktop-theme', domain: 'app', label: 'Theme', icon: Palette },
  { id: 'desktop-about', domain: 'app', label: 'About', icon: Info },
  { id: 'desktop-servers', domain: 'app', label: 'Servers', icon: ServerIcon },
  { id: 'desktop-path-mappings', domain: 'app', label: 'Path Mappings', icon: FolderSync },
];
