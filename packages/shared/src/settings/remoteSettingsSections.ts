/**
 * Shared registry for remote settings sections rendered by RemoteSettingsPanel.
 *
 * Organized to match qBittorrent's Options tabs:
 * Behavior, Downloads, Connection, Speed, BitTorrent, WebUI, Advanced
 */

import type { Preferences } from '../types/qbittorrent';
import { formatSpeedInKB } from '../utils/formatters';

// ─── Section & field types ───────────────────────────────────────────────────

export type RemoteSettingsSectionKey =
  | 'downloads'
  | 'connection'
  | 'speed'
  | 'bittorrent'
  | 'webui'
  | 'advanced';

export type FieldKind = 'boolean' | 'number' | 'unlimitedNumber' | 'string' | 'textarea' | 'select';

export type ByteUnit = 'b' | 'kb' | 'mb' | 'gb';

export type NumberInputUnitMode = 'bytes' | 'bytes-per-second';

export interface NumberEditorMeta {
  title: string;
  unit?: string;
  unitMode?: NumberInputUnitMode;
  unitDefault?: ByteUnit;
  toDisplay?: (value: number) => number;
  fromDisplay?: (display: number) => number;
  display?: (value: number) => string;
}

export interface SelectOption {
  value: number | string;
  label: string;
}

export interface BooleanField {
  kind: 'boolean';
  key: keyof Preferences;
  label?: string;
  description?: string;
  group?: string;
  visibleWhen?: (prefs: Record<string, unknown> | null) => boolean;
}

export interface NumberField {
  kind: 'number';
  key: keyof Preferences;
  label?: string;
  description?: string;
  group?: string;
  mobileEditor?: NumberEditorMeta;
  visibleWhen?: (prefs: Record<string, unknown> | null) => boolean;
}

export interface UnlimitedNumberField {
  kind: 'unlimitedNumber';
  key: keyof Preferences;
  label?: string;
  description?: string;
  group?: string;
  mobileEditor?: NumberEditorMeta;
  disabledValue: number;
  defaultEnabledValue: number;
  disabledLabel: string;
  enabledLabel?: string;
  visibleWhen?: (prefs: Record<string, unknown> | null) => boolean;
}

export interface StringField {
  kind: 'string';
  key: keyof Preferences;
  label?: string;
  description?: string;
  group?: string;
  visibleWhen?: (prefs: Record<string, unknown> | null) => boolean;
}

export interface TextareaField {
  kind: 'textarea';
  key: keyof Preferences;
  label?: string;
  description?: string;
  group?: string;
  visibleWhen?: (prefs: Record<string, unknown> | null) => boolean;
}

export interface SelectField {
  kind: 'select';
  key: keyof Preferences;
  label?: string;
  description?: string;
  group?: string;
  selectOptions: SelectOption[];
  visibleWhen?: (prefs: Record<string, unknown> | null) => boolean;
}

export type RemoteSettingsField =
  | BooleanField
  | NumberField
  | UnlimitedNumberField
  | StringField
  | TextareaField
  | SelectField;

export interface FieldGroup {
  key: string;
  title: string;
  description?: string;
}

export interface RemoteSettingsSectionDefinition {
  title: string;
  description?: string;
  groups?: FieldGroup[];
  desktopFields: RemoteSettingsField[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bool(
  key: keyof Preferences,
  label?: string,
  description?: string,
  opts?: { group?: string; visibleWhen?: (prefs: Record<string, unknown> | null) => boolean },
): BooleanField {
  return { kind: 'boolean', key, label, description, group: opts?.group, visibleWhen: opts?.visibleWhen };
}

function num(
  key: keyof Preferences,
  mobileEditor: NumberEditorMeta,
  extra?: { label?: string; description?: string; group?: string; visibleWhen?: (prefs: Record<string, unknown> | null) => boolean },
): NumberField {
  return { kind: 'number', key, mobileEditor, label: extra?.label, description: extra?.description, group: extra?.group, visibleWhen: extra?.visibleWhen };
}

function unlimitedNum(
  key: keyof Preferences,
  mobileEditor: NumberEditorMeta,
  extra: {
    label?: string;
    description?: string;
    group?: string;
    disabledValue?: number;
    defaultEnabledValue?: number;
    disabledLabel?: string;
    enabledLabel?: string;
    visibleWhen?: (prefs: Record<string, unknown> | null) => boolean;
  } = {},
): UnlimitedNumberField {
  return {
    kind: 'unlimitedNumber',
    key,
    mobileEditor,
    label: extra.label,
    description: extra.description,
    group: extra.group,
    disabledValue: extra.disabledValue ?? -1,
    defaultEnabledValue: extra.defaultEnabledValue ?? 1,
    disabledLabel: extra.disabledLabel ?? 'Unlimited',
    enabledLabel: extra.enabledLabel,
    visibleWhen: extra.visibleWhen,
  };
}

function speedEditor(title: string): NumberEditorMeta {
  return {
    title,
    unit: '0 = unlimited',
    unitMode: 'bytes-per-second',
    unitDefault: 'kb',
    display: (value) => (value === 0 ? '∞' : formatSpeedInKB(value)),
  };
}

function str(
  key: keyof Preferences,
  extra?: { label?: string; description?: string; group?: string; visibleWhen?: (prefs: Record<string, unknown> | null) => boolean },
): StringField {
  return { kind: 'string', key, label: extra?.label, description: extra?.description, group: extra?.group, visibleWhen: extra?.visibleWhen };
}

function txt(
  key: keyof Preferences,
  extra?: { label?: string; description?: string; group?: string; visibleWhen?: (prefs: Record<string, unknown> | null) => boolean },
): TextareaField {
  return { kind: 'textarea', key, label: extra?.label, description: extra?.description, group: extra?.group, visibleWhen: extra?.visibleWhen };
}

function sel(
  key: keyof Preferences,
  selectOptions: SelectOption[],
  extra?: { label?: string; description?: string; group?: string; visibleWhen?: (prefs: Record<string, unknown> | null) => boolean },
): SelectField {
  return { kind: 'select', key, selectOptions, label: extra?.label, description: extra?.description, group: extra?.group, visibleWhen: extra?.visibleWhen };
}

// ─── Registry ────────────────────────────────────────────────────────────────

export const REMOTE_SETTINGS_SECTIONS: Record<
  RemoteSettingsSectionKey,
  RemoteSettingsSectionDefinition
> = {

  // ═══════════════════════════════════════════════════════════════
  // DOWNLOADS
  // ═══════════════════════════════════════════════════════════════
  downloads: {
    title: 'Downloads',
    description: 'Torrent adding, save paths, and file handling.',
    groups: [
      { key: 'adding', title: 'When Adding a Torrent' },
      { key: 'duplicate', title: 'When Duplicate Torrent Is Being Added' },
      { key: 'disk', title: 'Disk' },
      { key: 'saving', title: 'Saving Management' },
      { key: 'paths', title: 'Save Paths' },
      { key: 'copy', title: 'Copy .torrent Files' },
      { key: 'excluded', title: 'Excluded File Names' },
      { key: 'email', title: 'Email Notification' },
      { key: 'autorun', title: 'Run External Program' },
    ],
    desktopFields: [
      // When adding a torrent
      sel(
        'torrent_content_layout',
        [
          { value: 'Original', label: 'Original' },
          { value: 'Subfolder', label: 'Create subfolder' },
          { value: 'NoSubfolder', label: 'Don\'t create subfolder' },
        ],
        { label: 'Torrent content layout', group: 'adding' },
      ),
      bool('add_to_top_of_queue', 'Add to top of queue', undefined, { group: 'adding' }),
      bool('start_paused_enabled', 'Do not start the download automatically', undefined, { group: 'adding' }),
      sel(
        'torrent_stop_condition',
        [
          { value: 'None', label: 'None' },
          { value: 'MetadataReceived', label: 'Metadata received' },
          { value: 'FilesChecked', label: 'Files checked' },
        ],
        { label: 'Torrent stop condition', group: 'adding' },
      ),

      // Duplicate handling
      bool('merge_trackers', 'Merge trackers to existing torrent', undefined, { group: 'duplicate' }),
      bool('delete_torrent_files_afterwards', 'Delete .torrent files afterwards', undefined, { group: 'duplicate' }),

      // Disk
      bool('preallocate_all', 'Pre-allocate disk space for all files', undefined, { group: 'disk' }),
      bool('incomplete_files_ext', 'Append .!qB extension to incomplete files', undefined, { group: 'disk' }),

      // Saving management
      sel(
        'auto_tmm_enabled',
        [
          { value: 0, label: 'Manual' },
          { value: 1, label: 'Automatic' },
        ],
        { label: 'Default torrent management mode', group: 'saving' },
      ),
      sel(
        'torrent_changed_tmm_enabled',
        [
          { value: 0, label: 'Do nothing' },
          { value: 1, label: 'Relocate torrent' },
        ],
        { label: 'When torrent category changed', group: 'saving' },
      ),
      sel(
        'save_path_changed_tmm_enabled',
        [
          { value: 0, label: 'Do nothing' },
          { value: 1, label: 'Relocate affected torrents' },
        ],
        { label: 'When default save path changed', group: 'saving' },
      ),
      sel(
        'category_changed_tmm_enabled',
        [
          { value: 0, label: 'Do nothing' },
          { value: 1, label: 'Relocate affected torrents' },
        ],
        { label: 'When category save path changed', group: 'saving' },
      ),
      bool('use_subcategories', 'Use subcategories', undefined, { group: 'saving' }),
      bool('use_category_paths_in_manual_mode', 'Use category paths in manual mode', undefined, { group: 'saving' }),

      // Save paths
      str('save_path', { label: 'Default save path', group: 'paths' }),
      bool('temp_path_enabled', 'Keep incomplete torrents in', undefined, { group: 'paths' }),
      str('temp_path', { label: 'Incomplete torrents path', group: 'paths', visibleWhen: (p) => Boolean(p?.temp_path_enabled) }),

      // Copy .torrent files
      str('export_dir', { label: 'Copy .torrent files to', description: 'Leave empty to disable', group: 'copy' }),
      str('export_dir_fin', { label: 'Copy .torrent files for finished downloads to', description: 'Leave empty to disable', group: 'copy' }),

      // Excluded file names
      bool('excluded_file_names_enabled', 'Enable excluded file names', undefined, { group: 'excluded' }),
      txt('excluded_file_names', { label: 'File name patterns', description: 'One pattern per line (supports wildcards)', group: 'excluded', visibleWhen: (p) => Boolean(p?.excluded_file_names_enabled) }),

      // Email notification
      bool('mail_notification_enabled', 'Email notification upon download completion', undefined, { group: 'email' }),
      str('mail_notification_sender', { label: 'From', group: 'email', visibleWhen: (p) => Boolean(p?.mail_notification_enabled) }),
      str('mail_notification_email', { label: 'To', group: 'email', visibleWhen: (p) => Boolean(p?.mail_notification_enabled) }),
      str('mail_notification_smtp', { label: 'SMTP server', group: 'email', visibleWhen: (p) => Boolean(p?.mail_notification_enabled) }),
      bool('mail_notification_ssl_enabled', 'This server requires a secure connection (SSL)', undefined, { group: 'email', visibleWhen: (p) => Boolean(p?.mail_notification_enabled) }),
      bool('mail_notification_auth_enabled', 'Authentication', undefined, { group: 'email', visibleWhen: (p) => Boolean(p?.mail_notification_enabled) }),
      str('mail_notification_username', { label: 'Username', group: 'email', visibleWhen: (p) => Boolean(p?.mail_notification_enabled) && Boolean(p?.mail_notification_auth_enabled) }),
      str('mail_notification_password', { label: 'Password', group: 'email', visibleWhen: (p) => Boolean(p?.mail_notification_enabled) && Boolean(p?.mail_notification_auth_enabled) }),

      // Autorun
      bool('autorun_on_torrent_added_enabled', 'Run on torrent added', undefined, { group: 'autorun' }),
      str('autorun_on_torrent_added_program', { label: 'Command', group: 'autorun', visibleWhen: (p) => Boolean(p?.autorun_on_torrent_added_enabled) }),
      bool('autorun_enabled', 'Run on torrent finished', undefined, { group: 'autorun' }),
      str('autorun_program', { label: 'Command', group: 'autorun', visibleWhen: (p) => Boolean(p?.autorun_enabled) }),
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // CONNECTION
  // ═══════════════════════════════════════════════════════════════
  connection: {
    title: 'Connection',
    description: 'Listening port, connection limits, proxy, and IP filtering.',
    groups: [
      { key: 'protocol', title: 'Peer Connection Protocol' },
      { key: 'port', title: 'Listening Port' },
      { key: 'limits', title: 'Connection Limits' },
      { key: 'i2p', title: 'I2P (Experimental)' },
      { key: 'proxy', title: 'Proxy Server' },
      { key: 'ipfilter', title: 'IP Filtering' },
    ],
    desktopFields: [
      // Protocol
      sel(
        'bittorrent_protocol',
        [
          { value: 0, label: 'TCP and µTP' },
          { value: 1, label: 'TCP' },
          { value: 2, label: 'µTP' },
        ],
        { label: 'Peer connection protocol', group: 'protocol' },
      ),

      // Listening port
      num('listen_port', { title: 'Listening port', unit: '1–65535' }, { label: 'Port used for incoming connections', group: 'port' }),
      bool('upnp', 'Use UPnP / NAT-PMP port forwarding from my router', undefined, { group: 'port' }),

      // Connection limits
      unlimitedNum('max_connec', { title: 'Max connections' }, { label: 'Global maximum number of connections', group: 'limits', defaultEnabledValue: 500 }),
      unlimitedNum('max_connec_per_torrent', { title: 'Max per torrent' }, { label: 'Maximum number of connections per torrent', group: 'limits', defaultEnabledValue: 100 }),
      unlimitedNum('max_uploads', { title: 'Max upload slots' }, { label: 'Global maximum number of upload slots', group: 'limits', defaultEnabledValue: 8 }),
      unlimitedNum('max_uploads_per_torrent', { title: 'Max per torrent' }, { label: 'Maximum number of upload slots per torrent', group: 'limits', defaultEnabledValue: 4 }),

      // I2P
      bool('i2p_enabled', 'I2P (Experimental)', undefined, { group: 'i2p' }),
      str('i2p_address', { label: 'Host', group: 'i2p', visibleWhen: (p) => Boolean(p?.i2p_enabled) }),
      num('i2p_port', { title: 'Port' }, { label: 'Port', group: 'i2p', visibleWhen: (p) => Boolean(p?.i2p_enabled) }),
      bool('i2p_mixed_mode', 'Mixed mode', undefined, { group: 'i2p', visibleWhen: (p) => Boolean(p?.i2p_enabled) }),

      // Proxy
      sel(
        'proxy_type',
        [
          { value: 0, label: '(None)' },
          { value: 1, label: 'HTTP' },
          { value: 2, label: 'SOCKS5' },
          { value: 3, label: 'HTTP with auth' },
          { value: 4, label: 'SOCKS5 with auth' },
          { value: 5, label: 'SOCKS4' },
        ],
        { label: 'Type', group: 'proxy' },
      ),
      str('proxy_ip', { label: 'Host', group: 'proxy', visibleWhen: (p) => Number(p?.proxy_type) > 0 }),
      num('proxy_port', { title: 'Port' }, { label: 'Port', group: 'proxy', visibleWhen: (p) => Number(p?.proxy_type) > 0 }),
      bool('proxy_peer_connections', 'Perform hostname lookup via proxy', undefined, { group: 'proxy', visibleWhen: (p) => Number(p?.proxy_type) > 0 }),
      bool('proxy_auth_enabled', 'Authentication', undefined, { group: 'proxy', visibleWhen: (p) => Number(p?.proxy_type) > 0 }),
      str('proxy_username', { label: 'Username', group: 'proxy', visibleWhen: (p) => Number(p?.proxy_type) > 0 && Boolean(p?.proxy_auth_enabled) }),
      str('proxy_password', { label: 'Password', group: 'proxy', visibleWhen: (p) => Number(p?.proxy_type) > 0 && Boolean(p?.proxy_auth_enabled) }),
      bool('proxy_torrents_only', 'Use proxy for BitTorrent purposes', undefined, { group: 'proxy', visibleWhen: (p) => Number(p?.proxy_type) > 0 }),

      // IP filtering
      bool('ip_filter_enabled', 'Enable IP filtering', undefined, { group: 'ipfilter' }),
      str('ip_filter_path', { label: 'Filter path (.dat, .p2p, .p2b)', group: 'ipfilter', visibleWhen: (p) => Boolean(p?.ip_filter_enabled) }),
      bool('ip_filter_trackers', 'Apply to trackers', undefined, { group: 'ipfilter', visibleWhen: (p) => Boolean(p?.ip_filter_enabled) }),
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // SPEED
  // ═══════════════════════════════════════════════════════════════
  speed: {
    title: 'Speed',
    description: 'Global and alternative rate limits, scheduling.',
    groups: [
      { key: 'global', title: 'Global Rate Limits' },
      { key: 'alt', title: 'Alternative Rate Limits' },
      { key: 'schedule', title: 'Schedule' },
      { key: 'rate-settings', title: 'Rate Limit Settings' },
    ],
    desktopFields: [
      // Global rate limits
      num('up_limit', speedEditor('Upload'), { label: 'Upload', description: '0 means unlimited', group: 'global' }),
      num('dl_limit', speedEditor('Download'), { label: 'Download', description: '0 means unlimited', group: 'global' }),

      // Alternative rate limits
      num('alt_up_limit', speedEditor('Alt upload'), { label: 'Upload', description: '0 means unlimited', group: 'alt' }),
      num('alt_dl_limit', speedEditor('Alt download'), { label: 'Download', description: '0 means unlimited', group: 'alt' }),

      // Schedule
      bool('scheduler_enabled', 'Schedule the use of alternative rate limits', undefined, { group: 'schedule' }),
      num('schedule_from_hour', { title: 'From hour' }, { label: 'From hour', group: 'schedule', visibleWhen: (p) => Boolean(p?.scheduler_enabled) }),
      num('schedule_from_min', { title: 'From min' }, { label: 'From minute', group: 'schedule', visibleWhen: (p) => Boolean(p?.scheduler_enabled) }),
      num('schedule_to_hour', { title: 'To hour' }, { label: 'To hour', group: 'schedule', visibleWhen: (p) => Boolean(p?.scheduler_enabled) }),
      num('schedule_to_min', { title: 'To min' }, { label: 'To minute', group: 'schedule', visibleWhen: (p) => Boolean(p?.scheduler_enabled) }),
      sel(
        'scheduler_days',
        [
          { value: 0, label: 'Every day' },
          { value: 1, label: 'Weekdays' },
          { value: 2, label: 'Weekends' },
          { value: 3, label: 'Monday' },
          { value: 4, label: 'Tuesday' },
          { value: 5, label: 'Wednesday' },
          { value: 6, label: 'Thursday' },
          { value: 7, label: 'Friday' },
          { value: 8, label: 'Saturday' },
          { value: 9, label: 'Sunday' },
        ],
        { label: 'When', group: 'schedule', visibleWhen: (p) => Boolean(p?.scheduler_enabled) },
      ),

      // Rate limit settings
      bool('limit_utp_rate', 'Apply rate limit to µTP protocol', undefined, { group: 'rate-settings' }),
      bool('limit_tcp_overhead', 'Apply rate limit to transport overhead', undefined, { group: 'rate-settings' }),
      bool('limit_lan_peers', 'Apply rate limit to peers on LAN', undefined, { group: 'rate-settings' }),
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // BITTORRENT
  // ═══════════════════════════════════════════════════════════════
  bittorrent: {
    title: 'BitTorrent',
    description: 'Privacy, encryption, queueing, seeding limits, and trackers.',
    groups: [
      { key: 'privacy', title: 'Privacy' },
      { key: 'checking', title: 'Torrent Checking' },
      { key: 'queueing', title: 'Torrent Queueing' },
      { key: 'slow', title: 'Do Not Count Slow Torrents' },
      { key: 'seeding', title: 'Seeding Limits' },
      { key: 'trackers', title: 'Automatically Add Trackers' },
    ],
    desktopFields: [
      // Privacy
      bool('dht', 'Enable DHT (decentralized network) to find more peers', undefined, { group: 'privacy' }),
      bool('pex', 'Enable Peer Exchange (PeX) to find more peers', undefined, { group: 'privacy' }),
      bool('lsd', 'Enable Local Peer Discovery to find more peers', undefined, { group: 'privacy' }),
      sel('encryption', [{ value: 0, label: 'Allow encryption' }, { value: 1, label: 'Force encryption' }, { value: 2, label: 'Disable encryption' }], { label: 'Encryption mode', group: 'privacy' }),
      bool('anonymous_mode', 'Enable anonymous mode', undefined, { group: 'privacy' }),

      // Checking
      num('max_active_checking_torrents', { title: 'Max checking' }, { label: 'Max active checking torrents', group: 'checking' }),

      // Queueing
      bool('queueing_enabled', 'Torrent queueing', undefined, { group: 'queueing' }),
      num('max_active_downloads', { title: 'Max downloads' }, { label: 'Maximum active downloads', group: 'queueing', visibleWhen: (p) => Boolean(p?.queueing_enabled) }),
      num('max_active_uploads', { title: 'Max uploads' }, { label: 'Maximum active uploads', group: 'queueing', visibleWhen: (p) => Boolean(p?.queueing_enabled) }),
      num('max_active_torrents', { title: 'Max torrents' }, { label: 'Maximum active torrents', group: 'queueing', visibleWhen: (p) => Boolean(p?.queueing_enabled) }),

      // Slow torrents
      bool('dont_count_slow_torrents', 'Do not count slow torrents in these limits', undefined, { group: 'slow', visibleWhen: (p) => Boolean(p?.queueing_enabled) }),
      num('slow_torrent_dl_rate_threshold', speedEditor('Download rate threshold'), { label: 'Download rate threshold', group: 'slow', visibleWhen: (p) => Boolean(p?.queueing_enabled) && Boolean(p?.dont_count_slow_torrents) }),
      num('slow_torrent_ul_rate_threshold', speedEditor('Upload rate threshold'), { label: 'Upload rate threshold', group: 'slow', visibleWhen: (p) => Boolean(p?.queueing_enabled) && Boolean(p?.dont_count_slow_torrents) }),
      num('slow_torrent_inactive_timer', { title: 'Seconds' }, { label: 'Torrent inactivity timer (seconds)', group: 'slow', visibleWhen: (p) => Boolean(p?.queueing_enabled) && Boolean(p?.dont_count_slow_torrents) }),

      // Seeding limits
      bool('max_ratio_enabled', 'When ratio reaches', undefined, { group: 'seeding' }),
      num('max_ratio', { title: 'Ratio', toDisplay: (v) => Math.round(v * 100), fromDisplay: (v) => v / 100 }, { label: 'Ratio limit', group: 'seeding', visibleWhen: (p) => Boolean(p?.max_ratio_enabled) }),
      bool('max_seeding_time_enabled', 'When total seeding time reaches', undefined, { group: 'seeding' }),
      num('max_seeding_time', { title: 'Minutes' }, { label: 'Seeding time (minutes)', group: 'seeding', visibleWhen: (p) => Boolean(p?.max_seeding_time_enabled) }),
      bool('max_inactive_seeding_time_enabled', 'When inactive seeding time reaches', undefined, { group: 'seeding' }),
      num('max_inactive_seeding_time', { title: 'Minutes' }, { label: 'Inactive time (minutes)', group: 'seeding', visibleWhen: (p) => Boolean(p?.max_inactive_seeding_time_enabled) }),
      sel('max_ratio_act', [{ value: 0, label: 'Pause torrent' }, { value: 1, label: 'Remove torrent' }, { value: 6, label: 'Stop torrent' }], { label: 'Then', group: 'seeding' }),

      // Trackers
      bool('add_trackers_enabled', 'Automatically append these trackers to new downloads', undefined, { group: 'trackers' }),
      txt('add_trackers', { label: 'Trackers (one URL per line)', group: 'trackers', visibleWhen: (p) => Boolean(p?.add_trackers_enabled) }),
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // WEBUI
  // ═══════════════════════════════════════════════════════════════
  webui: {
    title: 'WebUI',
    description: 'Remote access, authentication, security, and reverse proxy.',
    groups: [
      { key: 'webui-base', title: 'Web User Interface (Remote control)' },
      { key: 'https', title: 'HTTPS' },
      { key: 'auth', title: 'Authentication' },
      { key: 'security', title: 'Security' },
      { key: 'headers', title: 'Custom HTTP Headers' },
      { key: 'reverse-proxy', title: 'Reverse Proxy' },
      { key: 'dyndns', title: 'Dynamic DNS' },
      { key: 'alt-webui', title: 'Alternative WebUI' },
    ],
    desktopFields: [
      // Base
      str('web_ui_address', { label: 'IP address', group: 'webui-base' }),
      num('web_ui_port', { title: 'Port' }, { label: 'Port', group: 'webui-base' }),
      bool('web_ui_upnp', 'Use UPnP / NAT-PMP to forward the port from my router', undefined, { group: 'webui-base' }),

      // HTTPS
      bool('use_https', 'Use HTTPS instead of HTTP', undefined, { group: 'https' }),
      txt('web_ui_https_cert', { label: 'Certificate', group: 'https', visibleWhen: (p) => Boolean(p?.use_https) }),
      txt('web_ui_https_key', { label: 'Key', group: 'https', visibleWhen: (p) => Boolean(p?.use_https) }),

      // Auth
      str('web_ui_username', { label: 'Username', group: 'auth' }),
      bool('bypass_local_auth', 'Bypass authentication for clients on localhost', undefined, { group: 'auth' }),
      bool('bypass_auth_subnet_whitelist_enabled', 'Bypass authentication for clients in whitelisted IP subnets', undefined, { group: 'auth' }),
      txt('bypass_auth_subnet_whitelist', { label: 'Whitelisted subnets', description: 'Example: 172.17.32.0/24, fdff:ffff:c8::/40', group: 'auth', visibleWhen: (p) => Boolean(p?.bypass_auth_subnet_whitelist_enabled) }),
      num('web_ui_max_auth_fail_count', { title: 'Failures' }, { label: 'Ban client after consecutive failures', group: 'auth' }),
      num('web_ui_ban_duration', { title: 'Seconds' }, { label: 'Ban for (seconds)', group: 'auth' }),
      num('web_ui_session_timeout', { title: 'Seconds' }, { label: 'Session timeout (seconds)', group: 'auth' }),

      // Security
      bool('web_ui_clickjacking_protection_enabled', 'Enable clickjacking protection', undefined, { group: 'security' }),
      bool('web_ui_csrf_protection_enabled', 'Enable Cross-Site Request Forgery (CSRF) protection', undefined, { group: 'security' }),
      bool('web_ui_secure_cookie_enabled', 'Enable cookie Secure flag (requires HTTPS or localhost)', undefined, { group: 'security' }),
      bool('web_ui_host_header_validation_enabled', 'Enable Host header validation', undefined, { group: 'security' }),
      str('web_ui_domain_list', { label: 'Server domains', group: 'security', visibleWhen: (p) => Boolean(p?.web_ui_host_header_validation_enabled) }),

      // Headers
      bool('web_ui_use_custom_http_headers_enabled', 'Add custom HTTP headers', undefined, { group: 'headers' }),
      txt('web_ui_custom_http_headers', { label: 'Headers', description: 'Header: value pairs, one per line', group: 'headers', visibleWhen: (p) => Boolean(p?.web_ui_use_custom_http_headers_enabled) }),

      // Reverse proxy
      bool('web_ui_reverse_proxy_enabled', 'Enable reverse proxy support', undefined, { group: 'reverse-proxy' }),
      str('web_ui_reverse_proxies_list', { label: 'Trusted proxies list', group: 'reverse-proxy', visibleWhen: (p) => Boolean(p?.web_ui_reverse_proxy_enabled) }),

      // DynDNS
      bool('dyndns_enabled', 'Update my dynamic domain name', undefined, { group: 'dyndns' }),
      sel('dyndns_service', [{ value: 0, label: 'DynDNS' }, { value: 1, label: 'NO-IP' }], { label: 'Service', group: 'dyndns', visibleWhen: (p) => Boolean(p?.dyndns_enabled) }),
      str('dyndns_domain', { label: 'Domain name', group: 'dyndns', visibleWhen: (p) => Boolean(p?.dyndns_enabled) }),
      str('dyndns_username', { label: 'Username', group: 'dyndns', visibleWhen: (p) => Boolean(p?.dyndns_enabled) }),
      str('dyndns_password', { label: 'Password', group: 'dyndns', visibleWhen: (p) => Boolean(p?.dyndns_enabled) }),

      // Alt WebUI
      bool('alternative_webui_enabled', 'Use alternative WebUI', undefined, { group: 'alt-webui' }),
      str('alternative_webui_path', { label: 'Files location', group: 'alt-webui', visibleWhen: (p) => Boolean(p?.alternative_webui_enabled) }),
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // ADVANCED
  // ═══════════════════════════════════════════════════════════════
  advanced: {
    title: 'Advanced',
    description: 'qBittorrent internals and libtorrent performance tuning.',
    groups: [
      { key: 'qbt', title: 'qBittorrent Section' },
      { key: 'libtorrent', title: 'libtorrent Section' },
    ],
    desktopFields: [
      // qBittorrent section
      sel('resume_data_storage_type', [{ value: 'Legacy', label: 'Fastresume files' }, { value: 'SQLite', label: 'SQLite database' }], { label: 'Resume data storage type (requires restart)', group: 'qbt' }),
      sel('torrent_content_removing_mode', [{ value: 'MoveToTrash', label: 'Move to trash' }, { value: 'Delete', label: 'Delete files permanently' }], { label: 'Torrent content removing mode', group: 'qbt' }),
      num('memory_working_set_limit', { title: 'MiB' }, { label: 'Physical memory (RAM) usage limit (MiB)', group: 'qbt' }),
      str('current_network_interface', { label: 'Network interface', group: 'qbt' }),
      str('current_ip_address', { label: 'Optional IP address to bind to', group: 'qbt' }),
      num('save_resume_data_interval', { title: 'Minutes' }, { label: 'Save resume data interval (min)', group: 'qbt' }),
      num('save_statistics_interval', { title: 'Minutes' }, { label: 'Save statistics interval (min)', group: 'qbt' }),
      num('torrent_file_size_limit', { title: 'MiB' }, { label: '.torrent file size limit (MiB)', group: 'qbt' }),
      bool('confirm_torrent_recheck', 'Confirm torrent recheck', undefined, { group: 'qbt' }),
      bool('recheck_completed_torrents', 'Recheck torrents on completion', undefined, { group: 'qbt' }),
      str('customize_application_instance_name', { label: 'Customize application instance name', group: 'qbt' }),
      num('refresh_interval', { title: 'ms' }, { label: 'Refresh interval (ms)', group: 'qbt' }),
      bool('resolve_peer_countries', 'Resolve peer countries', undefined, { group: 'qbt' }),
      bool('reannounce_when_address_changed', 'Reannounce to all trackers when IP or port changed', undefined, { group: 'qbt' }),
      bool('enable_embedded_tracker', 'Enable embedded tracker', undefined, { group: 'qbt' }),
      num('embedded_tracker_port', { title: 'Port' }, { label: 'Embedded tracker port', group: 'qbt', visibleWhen: (p) => Boolean(p?.enable_embedded_tracker) }),
      bool('enable_port_forwarding_for_embedded_tracker', 'Enable port forwarding for embedded tracker', undefined, { group: 'qbt', visibleWhen: (p) => Boolean(p?.enable_embedded_tracker) }),
      bool('ignore_ssl_errors', 'Ignore SSL errors', undefined, { group: 'qbt' }),
      str('python_executable_path', { label: 'Python executable path (may require restart)', description: 'Auto detect if empty', group: 'qbt' }),

      // libtorrent section
      num('bdecode_depth_limit', { title: 'Limit' }, { label: 'Bdecode depth limit', group: 'libtorrent' }),
      num('bdecode_token_limit', { title: 'Limit' }, { label: 'Bdecode token limit', group: 'libtorrent' }),
      num('async_io_threads', { title: 'Threads' }, { label: 'Asynchronous I/O threads', group: 'libtorrent' }),
      num('hashing_threads', { title: 'Threads' }, { label: 'Hashing threads', group: 'libtorrent' }),
      num('file_pool_size', { title: 'Size' }, { label: 'File pool size', group: 'libtorrent' }),
      num('checking_memory_use', { title: 'MiB' }, { label: 'Outstanding memory when checking torrents (MiB)', group: 'libtorrent' }),
      num('disk_queue_size', { title: 'KiB' }, { label: 'Disk queue size (KiB)', group: 'libtorrent' }),
      sel('disk_io_type', [{ value: 0, label: 'Default' }, { value: 1, label: 'Memory mapped files' }, { value: 2, label: 'POSIX-compliant' }], { label: 'Disk IO type (requires restart)', group: 'libtorrent' }),
      sel('disk_io_read_mode', [{ value: 0, label: 'Enable OS cache' }, { value: 1, label: 'Disable OS cache' }], { label: 'Disk IO read mode', group: 'libtorrent' }),
      sel('disk_io_write_mode', [{ value: 0, label: 'Enable OS cache' }, { value: 1, label: 'Disable OS cache' }], { label: 'Disk IO write mode', group: 'libtorrent' }),
      bool('enable_piece_extent_affinity', 'Use piece extent affinity', undefined, { group: 'libtorrent' }),
      bool('enable_upload_suggestions', 'Send upload piece suggestions', undefined, { group: 'libtorrent' }),
      num('send_buffer_watermark', { title: 'KiB' }, { label: 'Send buffer watermark (KiB)', group: 'libtorrent' }),
      num('send_buffer_low_watermark', { title: 'KiB' }, { label: 'Send buffer low watermark (KiB)', group: 'libtorrent' }),
      num('send_buffer_watermark_factor', { title: '%' }, { label: 'Send buffer watermark factor (%)', group: 'libtorrent' }),
      num('connection_speed', { title: 'Connections/s' }, { label: 'Outgoing connections per second', group: 'libtorrent' }),
      num('socket_send_buffer_size', { title: 'KiB' }, { label: 'Socket send buffer size [0: system default] (KiB)', group: 'libtorrent' }),
      num('socket_receive_buffer_size', { title: 'KiB' }, { label: 'Socket receive buffer size [0: system default] (KiB)', group: 'libtorrent' }),
      num('socket_backlog_size', { title: 'Size' }, { label: 'Socket backlog size', group: 'libtorrent' }),
      num('outgoing_ports_min', { title: 'Port' }, { label: 'Outgoing ports (Min) [0: disabled]', group: 'libtorrent' }),
      num('outgoing_ports_max', { title: 'Port' }, { label: 'Outgoing ports (Max) [0: disabled]', group: 'libtorrent' }),
      num('upnp_lease_duration', { title: 'Seconds' }, { label: 'UPnP lease duration [0: permanent]', group: 'libtorrent' }),
      num('peer_tos', { title: 'Value' }, { label: 'Type of service (ToS) for connections to peers', group: 'libtorrent' }),
      sel('utp_tcp_mixed_mode', [{ value: 0, label: 'Prefer TCP' }, { value: 1, label: 'Peer proportional' }], { label: 'µTP-TCP mixed mode algorithm', group: 'libtorrent' }),
      bool('idn_support_enabled', 'Support internationalized domain name (IDN)', undefined, { group: 'libtorrent' }),
      bool('enable_multi_connections_from_same_ip', 'Allow multiple connections from the same IP address', undefined, { group: 'libtorrent' }),
      bool('validate_https_tracker_certificate', 'Validate HTTPS tracker certificate', undefined, { group: 'libtorrent' }),
      bool('ssrf_mitigation', 'Server-side request forgery (SSRF) mitigation', undefined, { group: 'libtorrent' }),
      bool('block_peers_on_privileged_ports', 'Disallow connection to peers on privileged ports', undefined, { group: 'libtorrent' }),
      sel('upload_slots_behavior', [{ value: 0, label: 'Fixed slots' }, { value: 1, label: 'Upload rate based' }], { label: 'Upload slots behavior', group: 'libtorrent' }),
      sel('upload_choking_algorithm', [{ value: 0, label: 'Round-robin' }, { value: 1, label: 'Fastest upload' }, { value: 2, label: 'Anti-leech' }], { label: 'Upload choking algorithm', group: 'libtorrent' }),
      bool('announce_to_all_trackers', 'Always announce to all trackers in a tier', undefined, { group: 'libtorrent' }),
      bool('announce_to_all_tiers', 'Always announce to all tiers', undefined, { group: 'libtorrent' }),
      str('announce_ip', { label: 'IP address reported to trackers (requires restart)', group: 'libtorrent' }),
      num('announce_port', { title: 'Port' }, { label: 'Port reported to trackers [0: listening port]', group: 'libtorrent' }),
      num('max_concurrent_http_announces', { title: 'Announcements' }, { label: 'Max concurrent HTTP announces', group: 'libtorrent' }),
      num('stop_tracker_timeout', { title: 'Seconds' }, { label: 'Stop tracker timeout [0: disabled]', group: 'libtorrent' }),
      num('peer_turnover', { title: '%' }, { label: 'Peer turnover disconnect percentage (%)', group: 'libtorrent' }),
      num('peer_turnover_cutoff', { title: '%' }, { label: 'Peer turnover threshold percentage (%)', group: 'libtorrent' }),
      num('peer_turnover_interval', { title: 'Seconds' }, { label: 'Peer turnover disconnect interval (s)', group: 'libtorrent' }),
      num('request_queue_size', { title: 'Size' }, { label: 'Maximum outstanding requests to a single peer', group: 'libtorrent' }),
      str('dht_bootstrap_nodes', { label: 'DHT bootstrap nodes', group: 'libtorrent' }),
      num('i2p_inbound_quantity', { title: 'Qty' }, { label: 'I2P inbound quantity', group: 'libtorrent' }),
      num('i2p_outbound_quantity', { title: 'Qty' }, { label: 'I2P outbound quantity', group: 'libtorrent' }),
      num('i2p_inbound_length', { title: 'Length' }, { label: 'I2P inbound length', group: 'libtorrent' }),
      num('i2p_outbound_length', { title: 'Length' }, { label: 'I2P outbound length', group: 'libtorrent' }),
    ],
  },
};
