// Types for qBittorrent API responses

// Single torrent row shape used by both `/api/v2/torrents/info` (the explicit
// list command) and the accumulated maindata torrent map.
//
// As of T143.1, `qb-core::dto::parse_torrent_list` owns the validation
// boundary for the list endpoint, and `qb-core::dto::parse_torrent_list`
// populates this same shape on the wire. The optional fields below
// (`download_path`, `infohash_v1`, `infohash_v2`, `trackers_count`,
// `reannounce`, `popularity`) mirror the drift fields the Rust DTO
// tolerates as absent — qBittorrent omits them on some versions/rows.
// `state` is intentionally `string` (no narrow enum) so qBittorrent state
// names introduced across API versions pass through unchanged; UI state
// grouping remains a TypeScript view-model concern. `tags` stays
// comma-separated — consumers that need membership checks call
// `parseTorrentTags` from `@taurent/shared`.
export interface Torrent {
  added_on: number;
  amount_left: number;
  auto_tmm: boolean;
  availability: number;
  category: string;
  completed: number;
  completion_on: number;
  content_path: string;
  dl_limit: number;
  dlspeed: number;
  // Documented drift fields — qBittorrent may omit these depending on
  // version. Mirrors the `Option<T>` fields on the Rust `TorrentDto`.
  download_path?: string;
  downloaded: number;
  downloaded_session: number;
  eta: number;
  f_l_piece_prio: boolean;
  force_start: boolean;
  hash: string;
  infohash_v1?: string;
  infohash_v2?: string;
  last_activity: number;
  magnet_uri: string;
  max_ratio: number;
  max_seeding_time: number;
  name: string;
  num_complete: number;
  num_incomplete: number;
  num_leechs: number;
  num_seeds: number;
  priority: number;
  progress: number;
  ratio: number;
  ratio_limit: number;
  save_path: string;
  seeding_time: number;
  inactive_seeding_time?: number;
  seeding_time_limit: number;
  seen_complete: number;
  seq_dl: boolean;
  size: number;
  state: string;
  super_seeding: boolean;
  tags: string;
  time_active: number;
  total_size: number;
  tracker: string;
  trackers_count?: number;
  up_limit: number;
  uploaded: number;
  uploaded_session: number;
  upspeed: number;
  reannounce?: number;
  isPrivate?: boolean;
  popularity?: number;
}

export interface Preferences {
  locale: string;
  create_subfolder_enabled: boolean;
  start_paused_enabled: boolean;
  auto_delete_mode: number;
  preallocate_all: boolean;
  incomplete_files_ext: boolean;
  auto_tmm_enabled: number;
  torrent_changed_tmm_enabled: number;
  save_path_changed_tmm_enabled: number;
  category_changed_tmm_enabled: number;
  save_path: string;
  temp_path_enabled: boolean;
  temp_path: string;
  scan_dirs: Record<string, number>;
  export_dir: string;
  export_dir_fin: string;
  mail_notification_enabled: boolean;
  mail_notification_sender: string;
  mail_notification_email: string;
  mail_notification_smtp: string;
  mail_notification_ssl_enabled: boolean;
  mail_notification_auth_enabled: boolean;
  mail_notification_username: string;
  mail_notification_password: string;
  autorun_enabled: boolean;
  autorun_program: string;
  queueing_enabled: boolean;
  max_active_downloads: number;
  max_active_torrents: number;
  max_active_uploads: number;
  dont_count_slow_torrents: boolean;
  slow_torrent_dl_rate_threshold: number;
  slow_torrent_ul_rate_threshold: number;
  slow_torrent_inactive_timer: number;
  max_ratio_enabled: boolean;
  max_ratio: number;
  max_ratio_act: number;
  listen_port: number;
  upnp: boolean;
  random_port: boolean;
  dl_limit: number;
  up_limit: number;
  alt_dl_limit: number;
  alt_up_limit: number;
  max_connec: number;
  max_connec_per_torrent: number;
  max_uploads: number;
  max_uploads_per_torrent: number;
  enable_piece_extent_affinity: boolean;
  bittorrent_protocol: number;
  limit_utp_rate: boolean;
  limit_tcp_overhead: boolean;
  limit_lan_peers: boolean;
  scheduler_enabled: boolean;
  use_alt_speed_limits: boolean;
  schedule_from_hour: number;
  schedule_from_min: number;
  schedule_to_hour: number;
  schedule_to_min: number;
  scheduler_days: number;
  dht: boolean;
  pex: boolean;
  lsd: boolean;
  encryption: number;
  anonymous_mode: boolean;
  proxy_type: number;
  proxy_ip: string;
  proxy_port: number;
  proxy_peer_connections: boolean;
  proxy_auth_enabled: boolean;
  proxy_username: string;
  proxy_password: string;
  proxy_torrents_only: boolean;
  ip_filter_enabled: boolean;
  ip_filter_path: string;
  ip_filter_trackers: boolean;
  web_ui_domain_list: string;
  web_ui_address: string;
  web_ui_port: number;
  web_ui_upnp: boolean;
  web_ui_username: string;
  web_ui_password: string;
  web_ui_csrf_protection_enabled: boolean;
  web_ui_clickjacking_protection_enabled: boolean;
  web_ui_secure_cookie_enabled: boolean;
  web_ui_max_auth_fail_count: number;
  web_ui_ban_duration: number;
  web_ui_session_timeout: number;
  web_ui_host_header_validation_enabled: boolean;
  bypass_local_auth: boolean;
  bypass_auth_subnet_whitelist_enabled: boolean;
  bypass_auth_subnet_whitelist: string;
  alternative_webui_enabled: boolean;
  alternative_webui_path: string;
  use_https: boolean;
  ssl_key: string;
  ssl_cert: string;
  web_ui_https_key: string;
  web_ui_https_cert: string;
  dyndns_enabled: boolean;
  dyndns_service: number;
  dyndns_username: string;
  dyndns_password: string;
  dyndns_domain: string;
  rss_refresh_interval: number;
  rss_max_articles_per_feed: number;
  rss_processing_enabled: boolean;
  rss_auto_downloading_enabled: boolean;
  rss_download_repack_proper_episodes: boolean;
  rss_smart_episode_filters: string;
  add_trackers_enabled: boolean;
  add_trackers: string;
  web_ui_use_custom_http_headers_enabled: boolean;
  web_ui_custom_http_headers: string;
  max_seeding_time_enabled: boolean;
  max_seeding_time: number;
  announce_to_all_tiers: boolean;
  announce_to_all_trackers: boolean;
  async_io_threads: number;
  hashing_threads: number;
  file_pool_size: number;
  checking_memory_use: number;
  disk_cache: number;
  disk_cache_ttl: number;
  enable_upload_suggestions: boolean;
  upload_suggestions_interval: number;
  send_buffer_watermark: number;
  send_buffer_low_watermark: number;
  send_buffer_watermark_factor: number;
  connection_speed: number;
  socket_backlog_size: number;
  outgoing_ports_min: number;
  outgoing_ports_max: number;
  upnp_lease_duration: number;
  peer_tos: number;
  utp_tcp_mixed_mode: number;
  idn_support_enabled: boolean;
  enable_multi_connections_from_same_ip: boolean;
  validate_https_tracker_certificate: boolean;
  ssrf_mitigation: boolean;
  block_peers_on_privileged_ports: boolean;
  enable_embedded_tracker: boolean;
  embedded_tracker_port: number;
  mark_of_the_web: boolean;
  upload_slots_behavior: number;
  upload_choking_algorithm: number;
  announce_ip: string;
  max_concurrent_http_announces: number;
  stop_tracker_timeout: number;
  peer_turnover: number;
  peer_turnover_cutoff: number;
  peer_turnover_interval: number;
  request_queue_size: number;
  dht_bootstrap_nodes: string;
  i2p_enabled: boolean;
  i2p_address: string;
  i2p_port: number;
  i2p_mixed_mode: boolean;
  i2p_inbound_quantity: number;
  i2p_outbound_quantity: number;
  i2p_inbound_length: number;
  i2p_outbound_length: number;
  // Additional fields from qBittorrent WebAPI
  torrent_content_layout: string;
  add_to_top_of_queue: boolean;
  torrent_stop_condition: string;
  merge_trackers: boolean;
  excluded_file_names_enabled: boolean;
  excluded_file_names: string;
  autorun_on_torrent_added_enabled: boolean;
  autorun_on_torrent_added_program: string;
  recheck_completed_torrents: boolean;
  resolve_peer_countries: boolean;
  reannounce_when_address_changed: boolean;
  max_active_checking_torrents: number;
  max_inactive_seeding_time_enabled: boolean;
  max_inactive_seeding_time: number;
  resume_data_storage_type: string;
  torrent_file_size_limit: number;
  save_resume_data_interval: number;
  save_statistics_interval: number;
  confirm_torrent_recheck: boolean;
  refresh_interval: number;
  customize_application_instance_name: string;
  python_executable_path: string;
  torrent_content_removing_mode: string;
  memory_working_set_limit: number;
  current_network_interface: string;
  current_ip_address: string;
  disk_queue_size: number;
  disk_io_type: number;
  disk_io_read_mode: number;
  disk_io_write_mode: number;
  bdecode_depth_limit: number;
  bdecode_token_limit: number;
  socket_send_buffer_size: number;
  socket_receive_buffer_size: number;
  announce_to_all_trackers_in_tier: boolean;
  announce_port: number;
  add_trackers_url: string;
  web_ui_reverse_proxy_enabled: boolean;
  web_ui_reverse_proxies_list: string;
  ignore_ssl_errors: boolean;
  enable_port_forwarding_for_embedded_tracker: boolean;
  use_subcategories: boolean;
  use_category_paths_in_manual_mode: boolean;
  delete_torrent_files_afterwards: boolean;
}

// Torrent generic properties
export interface TorrentProperties {
  save_path: string;
  creation_date: number;
  piece_size: number;
  comment: string;
  total_wasted: number;
  total_uploaded: number;
  total_uploaded_session: number;
  total_downloaded: number;
  total_downloaded_session: number;
  up_limit: number;
  dl_limit: number;
  time_elapsed: number;
  seeding_time: number;
  nb_connections: number;
  nb_connections_limit: number;
  share_ratio: number;
  addition_date: number;
  completion_date: number;
  created_by: string;
  dl_speed_avg: number;
  dl_speed: number;
  eta: number;
  last_seen: number;
  peers: number;
  peers_total: number;
  pieces_have: number;
  pieces_num: number;
  reannounce: number;
  seeds: number;
  seeds_total: number;
  total_size: number;
  up_speed_avg: number;
  up_speed: number;
  isPrivate?: boolean;
}

// Tracker information
export interface Tracker {
  url: string;
  status: number;
  tier: number;
  num_peers: number;
  num_seeds: number;
  num_leeches: number;
  num_downloaded: number;
  msg: string;
}

// Tracker status values
export enum TrackerStatus {
  Disabled = 0,
  NotContacted = 1,
  Working = 2,
  Updating = 3,
  NotWorking = 4,
}

// Web seed information
export interface WebSeed {
  url: string;
}

// Torrent file information
export interface TorrentFile {
  index: number;
  name: string;
  size: number;
  progress: number;
  priority: number;
  /** Defaults to false when omitted by older qBittorrent versions. */
  is_seed?: boolean;
  piece_range: [number, number];
  availability: number;
}

// File priority values
export enum FilePriority {
  DoNotDownload = 0,
  Normal = 1,
  High = 6,
  Maximal = 7,
}

// Piece state values
export enum PieceState {
  NotDownloaded = 0,
  Downloading = 1,
  Downloaded = 2,
}

// Category information
export interface Category {
  name: string;
  savePath: string;
}

// Transfer info — standalone contract for GET /api/v2/transfer/info.
//
// Core fields are required. `free_space_on_disk` is optional — qBittorrent
// added it in a later API version and it may be absent on older builds.
// Mirrors the Rust-owned `qb_core::dto::TransferInfoDto`.
export interface TransferInfo {
  dl_info_speed: number;
  dl_info_data: number;
  up_info_speed: number;
  up_info_data: number;
  dl_rate_limit: number;
  up_rate_limit: number;
  dht_nodes: number;
  connection_status: string;
  queueing: boolean;
  use_alt_speed_limits: boolean;
  refresh_interval: number;
  /** Free space on disk (added in later qBittorrent versions; absent on older builds) */
  free_space_on_disk?: number;
}

// Connection status values
export enum TorrentConnectionStatus {
  Connected = "connected",
  Firewalled = "firewalled",
  Disconnected = "disconnected",
}

// Torrent state values
export enum TorrentState {
  Error = "error",
  MissingFiles = "missingFiles",
  Uploading = "uploading",
  PausedUP = "pausedUP",
  QueuedUP = "queuedUP",
  StalledUP = "stalledUP",
  CheckingUP = "checkingUP",
  ForcedUP = "forcedUP",
  Allocating = "allocating",
  Downloading = "downloading",
  MetaDL = "metaDL",
  PausedDL = "pausedDL",
  QueuedDL = "queuedDL",
  StalledDL = "stalledDL",
  CheckingDL = "checkingDL",
  ForcedDL = "forcedDL",
  CheckingResumeData = "checkingResumeData",
  Moving = "moving",
  Unknown = "unknown",
}

// Application build info — standalone contract for GET /api/v2/app/buildInfo.
//
// The five long-standing documented fields are required. `zlib` and `platform`
// are optional typed extras that newer qBittorrent builds include. Mirrors the
// Rust-owned `qb_core::dto::BuildInfoDto`.
export interface BuildInfo {
  qt: string;
  libtorrent: string;
  boost: string;
  openssl: string;
  bitness: number;
  /** zlib version (added in newer qBittorrent builds; absent on older) */
  zlib?: string;
  /** Platform identifier (added in newer qBittorrent builds; absent on older) */
  platform?: string;
}

// Search result
export interface SearchResult {
  descrLink: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  nbLeechers: number;
  nbSeeders: number;
  siteUrl: string;
}

// Search status
export interface SearchStatus {
  id: number;
  status: string;
  total: number;
}

// Search plugin info
export interface SearchPlugin {
  enabled: boolean;
  fullName: string;
  name: string;
  supportedCategories: { id: string; name: string }[];
  url: string;
  version: string;
}

// RSS item
export interface RSSItem {
  name: string;
  url?: string;
}

// RSS rule
export interface RSSRule {
  enabled: boolean;
  mustContain: string;
  mustNotContain: string;
  useRegex: boolean;
  episodeFilter: string;
  smartFilter: boolean;
  previouslyMatchedEpisodes: string[];
  affectedFeeds: string[];
  ignoreDays: number;
  lastMatch: string;
  addPaused: boolean;
  assignedCategory: string;
  savePath: string;
}

// Server state from sync/maindata (also available via transfer/info)
export interface SyncServerState {
  dl_info_speed: number;
  dl_info_data: number;
  up_info_speed: number;
  up_info_data: number;
  dl_rate_limit: number;
  up_rate_limit: number;
  dht_nodes: number;
  connection_status: string;
  queueing: boolean;
  use_alt_speed_limits: boolean;
  refresh_interval: number;
  free_space_on_disk?: number;
  // All-time and session-cached statistics (from qBittorrent extended sync/maindata)
  alltime_dl?: number;
  alltime_ul?: number;
  average_time_queue?: number;
  global_ratio?: string;
  queued_io_jobs?: number;
  read_cache_hits?: number;
  read_cache_overload?: number | string;
  total_buffers_size?: number;
  total_peer_connections?: number;
  total_queued_size?: number;
  total_wasted_session?: number;
  write_cache_overload?: number | string;
}

// Sync main data — raw delta payload from GET /api/v2/sync/maindata
// Each field is optional because deltas only include changed fields.
// full_update=true indicates a full snapshot; subsequent responses are deltas.
export interface SyncMainData {
  rid: number;
  full_update: boolean;
  torrents?: Record<string, Torrent>;
  torrents_removed?: string[];
  categories?: Record<string, Category>;
  categories_removed?: string[];
  tags?: string[];
  tags_removed?: string[];
  server_state?: SyncServerState;
}

// Accumulated maindata state — the merged result of applying all deltas on top
// of the initial full snapshot. This is what the UI should consume, not the raw
// SyncMainData delta.
export interface MaindataState {
  rid: number;
  torrents: Record<string, Torrent>;
  categories: Record<string, Category>;
  tags: string[];
  server_state: SyncServerState | null;
}

// Peer data within a SyncTorrentPeers delta.
// All fields are optional to handle incremental qBittorrent deltas where only
// changed fields are present — partial rows are merged on top of accumulated state.
export interface SyncTorrentPeersPeerData {
  ip?: string;
  port?: number;
  client?: string;
  progress?: number;
  dl_speed?: number;
  up_speed?: number;
  downloaded?: number;
  uploaded?: number;
  connection?: string;
  flags?: string;
  flags_desc?: string;
  relevance?: number;
  files?: string;
  country?: string;
  country_code?: string;
}

// Sync torrent peers — raw delta payload from GET /api/v2/sync/torrentPeers
// Each field is optional because deltas only include changed fields.
// full_update=true indicates a full snapshot; subsequent responses are deltas.
export interface SyncTorrentPeers {
  rid: number;
  full_update: boolean;
  peers?: Record<string, SyncTorrentPeersPeerData>;
  peers_removed?: string[];
}

// Cookie (API v2.11.3+)
export interface Cookie {
  name: string;
  domain: string;
  path: string;
  value: string;
  expirationDate: number;
}
