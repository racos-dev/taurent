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

export type RemoteSettingsTranslationKey = `remoteSettings.${string}`;

export interface NumberEditorMeta {
  titleKey: RemoteSettingsTranslationKey;
  unitKey?: RemoteSettingsTranslationKey;
  unitMode?: NumberInputUnitMode;
  unitDefault?: ByteUnit;
  toDisplay?: (value: number) => number;
  fromDisplay?: (display: number) => number;
  display?: (value: number) => string;
}

export interface SelectOption {
  value: number | string;
  labelKey: RemoteSettingsTranslationKey;
}

export interface BooleanField {
  kind: 'boolean';
  key: keyof Preferences;
  labelKey: RemoteSettingsTranslationKey;
  descriptionKey?: RemoteSettingsTranslationKey;
  group?: string;
  visibleWhen?: (prefs: Record<string, unknown> | null) => boolean;
}

export interface NumberField {
  kind: 'number';
  key: keyof Preferences;
  labelKey: RemoteSettingsTranslationKey;
  descriptionKey?: RemoteSettingsTranslationKey;
  group?: string;
  mobileEditor?: NumberEditorMeta;
  visibleWhen?: (prefs: Record<string, unknown> | null) => boolean;
}

export interface UnlimitedNumberField {
  kind: 'unlimitedNumber';
  key: keyof Preferences;
  labelKey: RemoteSettingsTranslationKey;
  descriptionKey?: RemoteSettingsTranslationKey;
  group?: string;
  mobileEditor?: NumberEditorMeta;
  disabledValue: number;
  defaultEnabledValue: number;
  disabledLabelKey: RemoteSettingsTranslationKey;
  enabledLabelKey?: RemoteSettingsTranslationKey;
  visibleWhen?: (prefs: Record<string, unknown> | null) => boolean;
}

export interface StringField {
  kind: 'string';
  key: keyof Preferences;
  labelKey: RemoteSettingsTranslationKey;
  descriptionKey?: RemoteSettingsTranslationKey;
  group?: string;
  visibleWhen?: (prefs: Record<string, unknown> | null) => boolean;
}

export interface TextareaField {
  kind: 'textarea';
  key: keyof Preferences;
  labelKey: RemoteSettingsTranslationKey;
  descriptionKey?: RemoteSettingsTranslationKey;
  group?: string;
  visibleWhen?: (prefs: Record<string, unknown> | null) => boolean;
}

export interface SelectField {
  kind: 'select';
  key: keyof Preferences;
  labelKey: RemoteSettingsTranslationKey;
  descriptionKey?: RemoteSettingsTranslationKey;
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
}

export interface RemoteSettingsSectionDefinition {
  groups?: FieldGroup[];
  desktopFields: RemoteSettingsField[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FIELDS_WITH_DESCRIPTIONS = new Set<keyof Preferences>([
  'export_dir',
  'export_dir_fin',
  'excluded_file_names',
  'up_limit',
  'dl_limit',
  'alt_up_limit',
  'alt_dl_limit',
  'bypass_auth_subnet_whitelist',
  'web_ui_custom_http_headers',
  'python_executable_path',
]);

const FIELDS_WITH_EDITOR_UNITS = new Set<keyof Preferences>([
  'listen_port',
  'up_limit',
  'dl_limit',
  'alt_up_limit',
  'alt_dl_limit',
  'slow_torrent_dl_rate_threshold',
  'slow_torrent_ul_rate_threshold',
]);

function fieldTranslationKey(key: keyof Preferences, suffix: string): RemoteSettingsTranslationKey {
  return `remoteSettings.fields.${String(key)}.${suffix}`;
}

function fieldText(key: keyof Preferences) {
  return {
    labelKey: fieldTranslationKey(key, 'label'),
    descriptionKey: FIELDS_WITH_DESCRIPTIONS.has(key)
      ? fieldTranslationKey(key, 'description')
      : undefined,
  };
}

function bool(
  key: keyof Preferences,
  opts?: { group?: string; visibleWhen?: (prefs: Record<string, unknown> | null) => boolean },
): BooleanField {
  return { kind: 'boolean', key, ...fieldText(key), group: opts?.group, visibleWhen: opts?.visibleWhen };
}

type NumberEditorInput = Omit<NumberEditorMeta, 'titleKey' | 'unitKey'>;

function num(
  key: keyof Preferences,
  mobileEditor: NumberEditorInput,
  extra?: { group?: string; visibleWhen?: (prefs: Record<string, unknown> | null) => boolean },
): NumberField {
  return {
    kind: 'number',
    key,
    ...fieldText(key),
    mobileEditor: {
      ...mobileEditor,
      titleKey: fieldTranslationKey(key, 'editorTitle'),
      unitKey: FIELDS_WITH_EDITOR_UNITS.has(key) ? fieldTranslationKey(key, 'unit') : undefined,
    },
    group: extra?.group,
    visibleWhen: extra?.visibleWhen,
  };
}

function unlimitedNum(
  key: keyof Preferences,
  mobileEditor: NumberEditorInput,
  extra: {
    group?: string;
    disabledValue?: number;
    defaultEnabledValue?: number;
    visibleWhen?: (prefs: Record<string, unknown> | null) => boolean;
  } = {},
): UnlimitedNumberField {
  return {
    kind: 'unlimitedNumber',
    key,
    ...fieldText(key),
    mobileEditor: {
      ...mobileEditor,
      titleKey: fieldTranslationKey(key, 'editorTitle'),
      unitKey: FIELDS_WITH_EDITOR_UNITS.has(key) ? fieldTranslationKey(key, 'unit') : undefined,
    },
    group: extra.group,
    disabledValue: extra.disabledValue ?? -1,
    defaultEnabledValue: extra.defaultEnabledValue ?? 1,
    disabledLabelKey: 'remoteSettings.common.unlimited',
    visibleWhen: extra.visibleWhen,
  };
}

function speedEditor(): NumberEditorInput {
  return {
    unitMode: 'bytes-per-second',
    unitDefault: 'kb',
    display: (value) => (value === 0 ? '∞' : formatSpeedInKB(value)),
  };
}

function str(
  key: keyof Preferences,
  extra?: { group?: string; visibleWhen?: (prefs: Record<string, unknown> | null) => boolean },
): StringField {
  return { kind: 'string', key, ...fieldText(key), group: extra?.group, visibleWhen: extra?.visibleWhen };
}

function txt(
  key: keyof Preferences,
  extra?: { group?: string; visibleWhen?: (prefs: Record<string, unknown> | null) => boolean },
): TextareaField {
  return { kind: 'textarea', key, ...fieldText(key), group: extra?.group, visibleWhen: extra?.visibleWhen };
}

function sel(
  key: keyof Preferences,
  selectOptions: Array<Pick<SelectOption, 'value'>>,
  extra?: { group?: string; visibleWhen?: (prefs: Record<string, unknown> | null) => boolean },
): SelectField {
  return {
    kind: 'select',
    key,
    ...fieldText(key),
    selectOptions: selectOptions.map((option) => ({
      value: option.value,
      labelKey: fieldTranslationKey(key, `options.${String(option.value)}`),
    })),
    group: extra?.group,
    visibleWhen: extra?.visibleWhen,
  };
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
    groups: [
      { key: 'adding' },
      { key: 'duplicate' },
      { key: 'disk' },
      { key: 'saving' },
      { key: 'paths' },
      { key: 'copy' },
      { key: 'excluded' },
      { key: 'email' },
      { key: 'autorun' },
    ],
    desktopFields: [
      // When adding a torrent
      sel(
        'torrent_content_layout',
        [
          { value: 'Original' },
          { value: 'Subfolder' },
          { value: 'NoSubfolder' },
        ],
        { group: 'adding' },
      ),
      bool('add_to_top_of_queue', { group: 'adding' }),
      bool('start_paused_enabled', { group: 'adding' }),
      sel(
        'torrent_stop_condition',
        [
          { value: 'None' },
          { value: 'MetadataReceived' },
          { value: 'FilesChecked' },
        ],
        { group: 'adding' },
      ),

      // Duplicate handling
      bool('merge_trackers', { group: 'duplicate' }),
      bool('delete_torrent_files_afterwards', { group: 'duplicate' }),

      // Disk
      bool('preallocate_all', { group: 'disk' }),
      bool('incomplete_files_ext', { group: 'disk' }),

      // Saving management
      sel(
        'auto_tmm_enabled',
        [
          { value: 0 },
          { value: 1 },
        ],
        { group: 'saving' },
      ),
      sel(
        'torrent_changed_tmm_enabled',
        [
          { value: 0 },
          { value: 1 },
        ],
        { group: 'saving' },
      ),
      sel(
        'save_path_changed_tmm_enabled',
        [
          { value: 0 },
          { value: 1 },
        ],
        { group: 'saving' },
      ),
      sel(
        'category_changed_tmm_enabled',
        [
          { value: 0 },
          { value: 1 },
        ],
        { group: 'saving' },
      ),
      bool('use_subcategories', { group: 'saving' }),
      bool('use_category_paths_in_manual_mode', { group: 'saving' }),

      // Save paths
      str('save_path', { group: 'paths' }),
      bool('temp_path_enabled', { group: 'paths' }),
      str('temp_path', { group: 'paths', visibleWhen: (p) => Boolean(p?.temp_path_enabled) }),

      // Copy .torrent files
      str('export_dir', { group: 'copy' }),
      str('export_dir_fin', { group: 'copy' }),

      // Excluded file names
      bool('excluded_file_names_enabled', { group: 'excluded' }),
      txt('excluded_file_names', { group: 'excluded', visibleWhen: (p) => Boolean(p?.excluded_file_names_enabled) }),

      // Email notification
      bool('mail_notification_enabled', { group: 'email' }),
      str('mail_notification_sender', { group: 'email', visibleWhen: (p) => Boolean(p?.mail_notification_enabled) }),
      str('mail_notification_email', { group: 'email', visibleWhen: (p) => Boolean(p?.mail_notification_enabled) }),
      str('mail_notification_smtp', { group: 'email', visibleWhen: (p) => Boolean(p?.mail_notification_enabled) }),
      bool('mail_notification_ssl_enabled', { group: 'email', visibleWhen: (p) => Boolean(p?.mail_notification_enabled) }),
      bool('mail_notification_auth_enabled', { group: 'email', visibleWhen: (p) => Boolean(p?.mail_notification_enabled) }),
      str('mail_notification_username', { group: 'email', visibleWhen: (p) => Boolean(p?.mail_notification_enabled) && Boolean(p?.mail_notification_auth_enabled) }),
      str('mail_notification_password', { group: 'email', visibleWhen: (p) => Boolean(p?.mail_notification_enabled) && Boolean(p?.mail_notification_auth_enabled) }),

      // Autorun
      bool('autorun_on_torrent_added_enabled', { group: 'autorun' }),
      str('autorun_on_torrent_added_program', { group: 'autorun', visibleWhen: (p) => Boolean(p?.autorun_on_torrent_added_enabled) }),
      bool('autorun_enabled', { group: 'autorun' }),
      str('autorun_program', { group: 'autorun', visibleWhen: (p) => Boolean(p?.autorun_enabled) }),
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // CONNECTION
  // ═══════════════════════════════════════════════════════════════
  connection: {
    groups: [
      { key: 'protocol' },
      { key: 'port' },
      { key: 'limits' },
      { key: 'i2p' },
      { key: 'proxy' },
      { key: 'ipfilter' },
    ],
    desktopFields: [
      // Protocol
      sel(
        'bittorrent_protocol',
        [
          { value: 0 },
          { value: 1 },
          { value: 2 },
        ],
        { group: 'protocol' },
      ),

      // Listening port
      num('listen_port', {}, { group: 'port' }),
      bool('upnp', { group: 'port' }),

      // Connection limits
      unlimitedNum('max_connec', {}, { group: 'limits', defaultEnabledValue: 500 }),
      unlimitedNum('max_connec_per_torrent', {}, { group: 'limits', defaultEnabledValue: 100 }),
      unlimitedNum('max_uploads', {}, { group: 'limits', defaultEnabledValue: 8 }),
      unlimitedNum('max_uploads_per_torrent', {}, { group: 'limits', defaultEnabledValue: 4 }),

      // I2P
      bool('i2p_enabled', { group: 'i2p' }),
      str('i2p_address', { group: 'i2p', visibleWhen: (p) => Boolean(p?.i2p_enabled) }),
      num('i2p_port', {}, { group: 'i2p', visibleWhen: (p) => Boolean(p?.i2p_enabled) }),
      bool('i2p_mixed_mode', { group: 'i2p', visibleWhen: (p) => Boolean(p?.i2p_enabled) }),

      // Proxy
      sel(
        'proxy_type',
        [
          { value: 0 },
          { value: 1 },
          { value: 2 },
          { value: 3 },
          { value: 4 },
          { value: 5 },
        ],
        { group: 'proxy' },
      ),
      str('proxy_ip', { group: 'proxy', visibleWhen: (p) => Number(p?.proxy_type) > 0 }),
      num('proxy_port', {}, { group: 'proxy', visibleWhen: (p) => Number(p?.proxy_type) > 0 }),
      bool('proxy_peer_connections', { group: 'proxy', visibleWhen: (p) => Number(p?.proxy_type) > 0 }),
      bool('proxy_auth_enabled', { group: 'proxy', visibleWhen: (p) => Number(p?.proxy_type) > 0 }),
      str('proxy_username', { group: 'proxy', visibleWhen: (p) => Number(p?.proxy_type) > 0 && Boolean(p?.proxy_auth_enabled) }),
      str('proxy_password', { group: 'proxy', visibleWhen: (p) => Number(p?.proxy_type) > 0 && Boolean(p?.proxy_auth_enabled) }),
      bool('proxy_torrents_only', { group: 'proxy', visibleWhen: (p) => Number(p?.proxy_type) > 0 }),

      // IP filtering
      bool('ip_filter_enabled', { group: 'ipfilter' }),
      str('ip_filter_path', { group: 'ipfilter', visibleWhen: (p) => Boolean(p?.ip_filter_enabled) }),
      bool('ip_filter_trackers', { group: 'ipfilter', visibleWhen: (p) => Boolean(p?.ip_filter_enabled) }),
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // SPEED
  // ═══════════════════════════════════════════════════════════════
  speed: {
    groups: [
      { key: 'global' },
      { key: 'alt' },
      { key: 'schedule' },
      { key: 'rate-settings' },
    ],
    desktopFields: [
      // Global rate limits
      num('up_limit', speedEditor(), { group: 'global' }),
      num('dl_limit', speedEditor(), { group: 'global' }),

      // Alternative rate limits
      num('alt_up_limit', speedEditor(), { group: 'alt' }),
      num('alt_dl_limit', speedEditor(), { group: 'alt' }),

      // Schedule
      bool('scheduler_enabled', { group: 'schedule' }),
      num('schedule_from_hour', {}, { group: 'schedule', visibleWhen: (p) => Boolean(p?.scheduler_enabled) }),
      num('schedule_from_min', {}, { group: 'schedule', visibleWhen: (p) => Boolean(p?.scheduler_enabled) }),
      num('schedule_to_hour', {}, { group: 'schedule', visibleWhen: (p) => Boolean(p?.scheduler_enabled) }),
      num('schedule_to_min', {}, { group: 'schedule', visibleWhen: (p) => Boolean(p?.scheduler_enabled) }),
      sel(
        'scheduler_days',
        [
          { value: 0 },
          { value: 1 },
          { value: 2 },
          { value: 3 },
          { value: 4 },
          { value: 5 },
          { value: 6 },
          { value: 7 },
          { value: 8 },
          { value: 9 },
        ],
        { group: 'schedule', visibleWhen: (p) => Boolean(p?.scheduler_enabled) },
      ),

      // Rate limit settings
      bool('limit_utp_rate', { group: 'rate-settings' }),
      bool('limit_tcp_overhead', { group: 'rate-settings' }),
      bool('limit_lan_peers', { group: 'rate-settings' }),
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // BITTORRENT
  // ═══════════════════════════════════════════════════════════════
  bittorrent: {
    groups: [
      { key: 'privacy' },
      { key: 'checking' },
      { key: 'queueing' },
      { key: 'slow' },
      { key: 'seeding' },
      { key: 'trackers' },
    ],
    desktopFields: [
      // Privacy
      bool('dht', { group: 'privacy' }),
      bool('pex', { group: 'privacy' }),
      bool('lsd', { group: 'privacy' }),
      sel('encryption', [{ value: 0 }, { value: 1 }, { value: 2 }], { group: 'privacy' }),
      bool('anonymous_mode', { group: 'privacy' }),

      // Checking
      num('max_active_checking_torrents', {}, { group: 'checking' }),

      // Queueing
      bool('queueing_enabled', { group: 'queueing' }),
      num('max_active_downloads', {}, { group: 'queueing', visibleWhen: (p) => Boolean(p?.queueing_enabled) }),
      num('max_active_uploads', {}, { group: 'queueing', visibleWhen: (p) => Boolean(p?.queueing_enabled) }),
      num('max_active_torrents', {}, { group: 'queueing', visibleWhen: (p) => Boolean(p?.queueing_enabled) }),

      // Slow torrents
      bool('dont_count_slow_torrents', { group: 'slow', visibleWhen: (p) => Boolean(p?.queueing_enabled) }),
      num('slow_torrent_dl_rate_threshold', speedEditor(), { group: 'slow', visibleWhen: (p) => Boolean(p?.queueing_enabled) && Boolean(p?.dont_count_slow_torrents) }),
      num('slow_torrent_ul_rate_threshold', speedEditor(), { group: 'slow', visibleWhen: (p) => Boolean(p?.queueing_enabled) && Boolean(p?.dont_count_slow_torrents) }),
      num('slow_torrent_inactive_timer', {}, { group: 'slow', visibleWhen: (p) => Boolean(p?.queueing_enabled) && Boolean(p?.dont_count_slow_torrents) }),

      // Seeding limits
      bool('max_ratio_enabled', { group: 'seeding' }),
      num('max_ratio', { toDisplay: (v) => Math.round(v * 100), fromDisplay: (v) => v / 100 }, { group: 'seeding', visibleWhen: (p) => Boolean(p?.max_ratio_enabled) }),
      bool('max_seeding_time_enabled', { group: 'seeding' }),
      num('max_seeding_time', {}, { group: 'seeding', visibleWhen: (p) => Boolean(p?.max_seeding_time_enabled) }),
      bool('max_inactive_seeding_time_enabled', { group: 'seeding' }),
      num('max_inactive_seeding_time', {}, { group: 'seeding', visibleWhen: (p) => Boolean(p?.max_inactive_seeding_time_enabled) }),
      sel('max_ratio_act', [{ value: 0 }, { value: 1 }, { value: 6 }], { group: 'seeding' }),

      // Trackers
      bool('add_trackers_enabled', { group: 'trackers' }),
      txt('add_trackers', { group: 'trackers', visibleWhen: (p) => Boolean(p?.add_trackers_enabled) }),
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // WEBUI
  // ═══════════════════════════════════════════════════════════════
  webui: {
    groups: [
      { key: 'webui-base' },
      { key: 'https' },
      { key: 'auth' },
      { key: 'security' },
      { key: 'headers' },
      { key: 'reverse-proxy' },
      { key: 'dyndns' },
      { key: 'alt-webui' },
    ],
    desktopFields: [
      // Base
      str('web_ui_address', { group: 'webui-base' }),
      num('web_ui_port', {}, { group: 'webui-base' }),
      bool('web_ui_upnp', { group: 'webui-base' }),

      // HTTPS
      bool('use_https', { group: 'https' }),
      txt('web_ui_https_cert', { group: 'https', visibleWhen: (p) => Boolean(p?.use_https) }),
      txt('web_ui_https_key', { group: 'https', visibleWhen: (p) => Boolean(p?.use_https) }),

      // Auth
      str('web_ui_username', { group: 'auth' }),
      bool('bypass_local_auth', { group: 'auth' }),
      bool('bypass_auth_subnet_whitelist_enabled', { group: 'auth' }),
      txt('bypass_auth_subnet_whitelist', { group: 'auth', visibleWhen: (p) => Boolean(p?.bypass_auth_subnet_whitelist_enabled) }),
      num('web_ui_max_auth_fail_count', {}, { group: 'auth' }),
      num('web_ui_ban_duration', {}, { group: 'auth' }),
      num('web_ui_session_timeout', {}, { group: 'auth' }),

      // Security
      bool('web_ui_clickjacking_protection_enabled', { group: 'security' }),
      bool('web_ui_csrf_protection_enabled', { group: 'security' }),
      bool('web_ui_secure_cookie_enabled', { group: 'security' }),
      bool('web_ui_host_header_validation_enabled', { group: 'security' }),
      str('web_ui_domain_list', { group: 'security', visibleWhen: (p) => Boolean(p?.web_ui_host_header_validation_enabled) }),

      // Headers
      bool('web_ui_use_custom_http_headers_enabled', { group: 'headers' }),
      txt('web_ui_custom_http_headers', { group: 'headers', visibleWhen: (p) => Boolean(p?.web_ui_use_custom_http_headers_enabled) }),

      // Reverse proxy
      bool('web_ui_reverse_proxy_enabled', { group: 'reverse-proxy' }),
      str('web_ui_reverse_proxies_list', { group: 'reverse-proxy', visibleWhen: (p) => Boolean(p?.web_ui_reverse_proxy_enabled) }),

      // DynDNS
      bool('dyndns_enabled', { group: 'dyndns' }),
      sel('dyndns_service', [{ value: 0 }, { value: 1 }], { group: 'dyndns', visibleWhen: (p) => Boolean(p?.dyndns_enabled) }),
      str('dyndns_domain', { group: 'dyndns', visibleWhen: (p) => Boolean(p?.dyndns_enabled) }),
      str('dyndns_username', { group: 'dyndns', visibleWhen: (p) => Boolean(p?.dyndns_enabled) }),
      str('dyndns_password', { group: 'dyndns', visibleWhen: (p) => Boolean(p?.dyndns_enabled) }),

      // Alt WebUI
      bool('alternative_webui_enabled', { group: 'alt-webui' }),
      str('alternative_webui_path', { group: 'alt-webui', visibleWhen: (p) => Boolean(p?.alternative_webui_enabled) }),
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // ADVANCED
  // ═══════════════════════════════════════════════════════════════
  advanced: {
    groups: [
      { key: 'qbt' },
      { key: 'libtorrent' },
    ],
    desktopFields: [
      // qBittorrent section
      sel('resume_data_storage_type', [{ value: 'Legacy' }, { value: 'SQLite' }], { group: 'qbt' }),
      sel('torrent_content_removing_mode', [{ value: 'MoveToTrash' }, { value: 'Delete' }], { group: 'qbt' }),
      num('memory_working_set_limit', {}, { group: 'qbt' }),
      str('current_network_interface', { group: 'qbt' }),
      str('current_ip_address', { group: 'qbt' }),
      num('save_resume_data_interval', {}, { group: 'qbt' }),
      num('save_statistics_interval', {}, { group: 'qbt' }),
      num('torrent_file_size_limit', {}, { group: 'qbt' }),
      bool('confirm_torrent_recheck', { group: 'qbt' }),
      bool('recheck_completed_torrents', { group: 'qbt' }),
      str('customize_application_instance_name', { group: 'qbt' }),
      num('refresh_interval', {}, { group: 'qbt' }),
      bool('resolve_peer_countries', { group: 'qbt' }),
      bool('reannounce_when_address_changed', { group: 'qbt' }),
      bool('enable_embedded_tracker', { group: 'qbt' }),
      num('embedded_tracker_port', {}, { group: 'qbt', visibleWhen: (p) => Boolean(p?.enable_embedded_tracker) }),
      bool('enable_port_forwarding_for_embedded_tracker', { group: 'qbt', visibleWhen: (p) => Boolean(p?.enable_embedded_tracker) }),
      bool('ignore_ssl_errors', { group: 'qbt' }),
      str('python_executable_path', { group: 'qbt' }),

      // libtorrent section
      num('bdecode_depth_limit', {}, { group: 'libtorrent' }),
      num('bdecode_token_limit', {}, { group: 'libtorrent' }),
      num('async_io_threads', {}, { group: 'libtorrent' }),
      num('hashing_threads', {}, { group: 'libtorrent' }),
      num('file_pool_size', {}, { group: 'libtorrent' }),
      num('checking_memory_use', {}, { group: 'libtorrent' }),
      num('disk_queue_size', {}, { group: 'libtorrent' }),
      sel('disk_io_type', [{ value: 0 }, { value: 1 }, { value: 2 }], { group: 'libtorrent' }),
      sel('disk_io_read_mode', [{ value: 0 }, { value: 1 }], { group: 'libtorrent' }),
      sel('disk_io_write_mode', [{ value: 0 }, { value: 1 }], { group: 'libtorrent' }),
      bool('enable_piece_extent_affinity', { group: 'libtorrent' }),
      bool('enable_upload_suggestions', { group: 'libtorrent' }),
      num('send_buffer_watermark', {}, { group: 'libtorrent' }),
      num('send_buffer_low_watermark', {}, { group: 'libtorrent' }),
      num('send_buffer_watermark_factor', {}, { group: 'libtorrent' }),
      num('connection_speed', {}, { group: 'libtorrent' }),
      num('socket_send_buffer_size', {}, { group: 'libtorrent' }),
      num('socket_receive_buffer_size', {}, { group: 'libtorrent' }),
      num('socket_backlog_size', {}, { group: 'libtorrent' }),
      num('outgoing_ports_min', {}, { group: 'libtorrent' }),
      num('outgoing_ports_max', {}, { group: 'libtorrent' }),
      num('upnp_lease_duration', {}, { group: 'libtorrent' }),
      num('peer_tos', {}, { group: 'libtorrent' }),
      sel('utp_tcp_mixed_mode', [{ value: 0 }, { value: 1 }], { group: 'libtorrent' }),
      bool('idn_support_enabled', { group: 'libtorrent' }),
      bool('enable_multi_connections_from_same_ip', { group: 'libtorrent' }),
      bool('validate_https_tracker_certificate', { group: 'libtorrent' }),
      bool('ssrf_mitigation', { group: 'libtorrent' }),
      bool('block_peers_on_privileged_ports', { group: 'libtorrent' }),
      sel('upload_slots_behavior', [{ value: 0 }, { value: 1 }], { group: 'libtorrent' }),
      sel('upload_choking_algorithm', [{ value: 0 }, { value: 1 }, { value: 2 }], { group: 'libtorrent' }),
      bool('announce_to_all_trackers', { group: 'libtorrent' }),
      bool('announce_to_all_tiers', { group: 'libtorrent' }),
      str('announce_ip', { group: 'libtorrent' }),
      num('announce_port', {}, { group: 'libtorrent' }),
      num('max_concurrent_http_announces', {}, { group: 'libtorrent' }),
      num('stop_tracker_timeout', {}, { group: 'libtorrent' }),
      num('peer_turnover', {}, { group: 'libtorrent' }),
      num('peer_turnover_cutoff', {}, { group: 'libtorrent' }),
      num('peer_turnover_interval', {}, { group: 'libtorrent' }),
      num('request_queue_size', {}, { group: 'libtorrent' }),
      str('dht_bootstrap_nodes', { group: 'libtorrent' }),
      num('i2p_inbound_quantity', {}, { group: 'libtorrent' }),
      num('i2p_outbound_quantity', {}, { group: 'libtorrent' }),
      num('i2p_inbound_length', {}, { group: 'libtorrent' }),
      num('i2p_outbound_length', {}, { group: 'libtorrent' }),
    ],
  },
};
