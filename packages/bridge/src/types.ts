// Shared session and DTO types for Tauri bridge

import type {
  Category,
  Preferences,
  SyncServerState,
  Torrent,
  TorrentFile,
  TorrentProperties,
  Tracker,
  TransferInfo,
  WebSeed,
} from '@taurent/shared/types/qbittorrent';

export type SessionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Re-exported from the codegen output at `generated/server-capabilities.ts`.
 * Keep the inline definition out of this file: the TOML profile at
 * `crates/qb-core/capabilities/qbittorrent-capabilities.toml` is the single
 * source of truth, regenerated with `pnpm codegen:capabilities`.
 */
import type { ServerCapabilities } from './generated/server-capabilities';

export type { ServerCapabilities };
export { makeServerCapabilities } from './generated/server-capabilities';

export interface SessionSnapshot {
  session_generation: number;
  server_id: string | null;
  server_name: string | null;
  server_url: string | null;
  /** qBittorrent webapi version string (e.g. "5.1.0"). `null` when not connected. */
  api_version: string | null;
  /** Server's qBittorrent application version string (e.g. "v5.0.0"). `null` when not connected. */
  app_version: string | null;
  /**
   * Server-resolved feature capabilities (Rust-owned). Defaults to
   * `{ all false }` when the session is not connected — the renderer
   * never needs to null-check this field after first snapshot.
   */
  capabilities: ServerCapabilities;
  status: SessionStatus;
  last_error: string | null;
}

export interface OperationResponse {
  session_generation: number;
  server_id: string | null;
  success: boolean;
}

// Torrent list envelope returned by `get_torrent_list` (GET /api/v2/torrents/info).
//
// Rust-owned DTO (T143.1): `qb-core::dto::parse_torrent_list` is the canonical
// validator and runs inside the `get_torrent_list` Tauri command; malformed
// upstream payloads fail at the Rust boundary. `torrents` is now typed as
// `Torrent[]` rather than `unknown` so the bridge adapters can expose the
// typed payload directly. The drift fields on `Torrent`
// (`download_path`, `infohash_v1`, `infohash_v2`, `trackers_count`,
// `reannounce`, `popularity`) are optional to match the Rust DTO.
//
// Maindata torrent maps (`SyncMainData.torrents`) now use the typed
// `Torrent` interface — row-level DTO validation is owned by Rust (T151).
export interface TorrentListResponse {
  session_generation: number;
  server_id: string | null;
  torrents: Torrent[];
}

// Torrent detail envelopes — Rust-owned Tauri command responses that wrap the
// typed inner payload in a session context. The bridge adapters unwrap these
// to expose plain detail payloads to consumers.
export interface TorrentPropertiesEnvelope {
  session_generation: number;
  server_id: string | null;
  properties: TorrentProperties;
}

export interface TorrentTrackersEnvelope {
  session_generation: number;
  server_id: string | null;
  trackers: Tracker[];
}

export interface TorrentFilesEnvelope {
  session_generation: number;
  server_id: string | null;
  files: TorrentFile[];
}

// Bridge-visible torrent detail payloads — Rust (qb-core::dto) owns the
// validation boundary for these endpoints, so the plain typed payload is
// exposed to consumers (and `createTorrentDetailHooks.ts` no longer needs
// the temporary compatibility unwrap).
export type TorrentPropertiesResponse = TorrentProperties;
export type TorrentTrackersResponse = Tracker[];
export type TorrentFilesResponse = TorrentFile[];

// Webseeds response — Rust returns an envelope with session context; adapters
// unwrap to { webseeds } before returning to consumers.
// Consumer: createTorrentDetailHooks.ts → useTorrentWebSeeds
// Rust-owned DTO (T153): `qb-core::dto::parse_webseeds` is the canonical
// validator and runs inside the `get_torrent_webseeds` Tauri command;
// malformed upstream payloads fail at the Rust boundary.
export interface TorrentWebseedsResponse {
  session_generation: number;
  server_id: string | null;
  webseeds: WebSeed[];
}

export interface PreferencesResponse {
  session_generation: number;
  server_id: string | null;
  preferences: Preferences;
}

export interface CategoriesResponse {
  session_generation: number;
  server_id: string | null;
  // Rust-owned DTO: categories is typed as a Record<string, Category> rather
  // than unknown now that the Rust backend parses and validates this field.
  categories: Record<string, Category>;
}

export interface TagsResponse {
  session_generation: number;
  server_id: string | null;
  tags: string[];
}

// Transfer info envelope — Rust-owned DTO (T153): `qb-core::dto::parse_transfer_info`
// is the canonical validator and runs inside the `get_transfer_info` Tauri command;
// malformed upstream payloads fail at the Rust boundary.
export interface TransferInfoResponse {
  session_generation: number;
  server_id: string | null;
  info: TransferInfo;
}

export interface SpeedLimitsModeResponse {
  session_generation: number;
  server_id: string | null;
  mode: boolean;
}

export interface DownloadLimitResponse {
  session_generation: number;
  server_id: string | null;
  limit: number;
}

export interface UploadLimitResponse {
  session_generation: number;
  server_id: string | null;
  limit: number;
}

export interface DefaultSavePathResponse {
  session_generation: number;
  server_id: string | null;
  path: string;
}

// Server management types (safe DTOs - no password)

export type CredentialStatus =
  | 'stored'
  | 'session_only'
  | 'missing'
  | 'unavailable'
  | 'not_requested'
  | 'unknown';

export interface SavedServerSummary {
  id: string;
  name: string;
  url: string;
  username: string;
  credential_status?: CredentialStatus;
  credential_warning?: string;
}

export interface PathMapping {
  serverPath: string;
  localPath: string;
}

export interface AddServerInput {
  name: string;
  url: string;
  username: string;
  password: string;
  remember_password?: boolean;
  /**
   * Optional qBittorrent API key. When provided, the backend authenticates with
   * the `Authorization: Bearer qbt_<key>` header instead of username/password.
   */
  api_key?: string;
}

export interface UpdateServerInput {
  id: string;
  name?: string;
  url?: string;
  username?: string;
  password?: string;
  /**
   * Optional qBittorrent API key. Omit to leave unchanged, pass a string to set
   * API-key auth, or pass null to clear a previously stored API key.
   */
  api_key?: string | null;
  remember_password?: boolean;
}

export interface ServerCredentialsInput {
  username: string;
  password: string;
  /**
   * Optional qBittorrent API key. Mirrors the Rust `ServerCredentialsInput::api_key`
   * field so callers can forward a stored API key through the same DTO.
   */
  api_key?: string;
}

// Torrent list params
export interface TorrentListParams {
  filter?: string;
  category?: string;
  tag?: string;
  sort?: string;
  reverse?: boolean;
  limit?: number;
  offset?: number;
  hashes?: string[];
}

// Add torrent options
export interface AddTorrentOptions {
  urls?: string;
  torrentFiles?: string[];
  savepath?: string;
  category?: string;
  tags?: string;
  skip_checking?: boolean;
  paused?: boolean;
  root_folder?: boolean;
  sequential_download?: boolean;
  rename?: string;
  up_limit?: number;
  dl_limit?: number;
  auto_tmm?: boolean;
  first_last_piece_prio?: boolean;
  content_layout?: 'Original' | 'Subfolder' | 'NoSubfolder';
  stop_condition?: 'none' | 'metadata' | 'files';
  add_to_top?: boolean;
  ratio_limit?: number;
  seeding_time_limit?: number;
}

// Retry constants
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 2000;

// Sync main data response from /api/v2/sync/maindata.
//
// Validation boundary (T151):
//   - Backend live sync is strict through `MaindataAccumulator::apply`
//     (`qb-core::sync::SyncDelta::parse`). That parser rejects malformed
//     envelope/container payloads (non-object present `torrents` /
//     `categories` / `server_state`; non-string present removal / tag
//     arrays; missing or non-numeric `rid`) and is the canonical
//     production boundary.
//   - `SyncMainData` is now only consumed by the Rust-validated backend
//     path (`MaindataAccumulator::apply` → `SyncDelta::parse`) and the
//     shared merge utility (`normalizeBackendMaindata`). The fallback
//     `sync_maindata` Tauri command and renderer poller
//     (`useMaindataSync`) have been removed — there is no longer a
//     "permissive renderer-boundary" path. All maindata ingestion flows
//     through the strict backend validator.
//   - Row-level DTO validation of individual torrent / category /
//     `server_state` rows is now done on the Rust side (T151).
//     The bridge types reflect the validated shapes — `torrents` is
//     `Record<string, Torrent>`, `categories` is `Record<string, Category>`,
//     and `server_state` is `SyncServerState`.
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

export interface SyncTorrentPeers {
  rid: number;
  full_update: boolean;
  peers?: Record<string, {
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
  }>;
  peers_removed?: string[];
}

export interface RetryState {
  isRetrying: boolean;
  attemptCount: number;
  maxAttempts: number;
  maxAttemptsReached: boolean;
}

// ---------------------------------------------------------------------------
// RSS response DTO types (T142.3)
//
// These interfaces mirror the Rust-owned `qb_core::dto::RssItemDto` /
// `RssRuleDto` types serialized by the `get_rss_items` / `get_rss_rules`
// Tauri commands. The Rust command boundary owns the validation, keyed-tree
// flattening, and shape contract; the bridge exposes the typed payload
// directly to consumers (no `unknown` coercion, no synthetic envelope).
// ---------------------------------------------------------------------------

/**
 * Single RSS item row from `get_rss_items`.
 * Mirrors `qb_core::dto::RssItemDto`.
 *
 * Wire field names are camelCase (`isFolder`). `uid` is omitted from the
 * wire when the Rust side has no value
 * (`skip_serializing_if = "Option::is_none"`), so it is typed as
 * optional. `url` is also serialized with `skip_serializing_if` on the
 * Rust side, but the existing `packages/web-ui` consumers
 * (`RSSScreenBody`, `RSSItemRow`) require the field to be present (typed
 * as `string | null`, never `undefined`) — see
 * `packages/web-core/src/rss/useRssController.ts` where the controller
 * coerces missing `url` values to `null` so the runtime shape stays in
 * sync with this type. Folder rows (from the legacy `{ folders }` shape
 * and from the array shape when an entry has no URL) have `isFolder:
 * true` and `url: null`.
 */
export interface RssItem {
  name: string;
  /** Feed URL. Coerced to `null` by the controller when the Rust side omits it. */
  url: string | null;
  /** Renamed from Rust `is_folder` to `isFolder` on the wire. */
  isFolder: boolean;
  /** Canonical path used for feed edits/deletes (qB's `\\`-joined path). */
  path: string;
  /** Optional stable ID when upstream RSS payload exposes one. */
  uid?: string | null;
}

/**
 * Single RSS rule row from `get_rss_rules`.
 * Mirrors `qb_core::dto::RssRuleDto`.
 *
 * Wire field names are camelCase. All fields default to safe values
 * (empty string / empty array / 0) when the upstream payload omits them.
 * Input parsing on the Rust side accepts both camelCase and snake_case
 * aliases for every field, so the wire shape is always camelCase.
 */
export interface RssRule {
  name: string;
  enabled: boolean;
  mustContain: string;
  mustNotContain: string;
  useRegex: boolean;
  episodeFilter: string;
  smartFilter: boolean;
  affectedFeeds: string[];
  ignoreDays: number;
  lastMatch: string;
  addPaused: boolean;
  assignedCategory: string;
  savePath: string;
}

// RSS response types
// T142.3: `items` and `rules` are now typed arrays matching the Rust-owned
// `RssItemDto` / `RssRuleDto` wire shape. The Rust command boundary returns
// the real session context as part of the envelope; the bridge no longer
// needs to synthesize `session_generation` / `server_id` placeholders.
export interface RSSItemsResponse {
  session_generation: number;
  server_id: string | null;
  items: RssItem[];
}

// ---------------------------------------------------------------------------
// Rust-owned live sync types (T130)
// These types mirror the Rust MaindataSnapshotResponse / MaindataSyncHealth
// structures returned by the get_maindata_snapshot and get_maindata_sync_status
// Tauri commands, and the maindata-sync-changed event payload.
// ---------------------------------------------------------------------------

/**
 * Live sync health states — mirrors qb_core::sync::SyncHealthState.
 */
export type SyncHealthState = 'idle' | 'healthy' | 'degraded' | 'retrying';

/**
 * Live sync health with consecutive error count and timestamps.
 * Mirrors qb_core::sync::MaindataSyncHealth.
 */
export interface MaindataSyncHealth {
  state: SyncHealthState;
  consecutive_errors: number;
  last_success_ts: number | null;
  last_error_ts: number | null;
  last_error_message: string | null;
}

/**
 * The accumulated maindata snapshot envelope.
 * Mirrors the Rust MaindataSnapshotEnvelope (server-owned, read-only).
 */
export interface MaindataSnapshotEnvelope {
  torrents: Record<string, Torrent>;
  categories: Record<string, Category>;
  tags: string[];
  server_state: SyncServerState | null;
}

/**
 * Full snapshot response from the get_maindata_snapshot Tauri command.
 * Includes session context (session_generation, server_id) plus the
 * accumulated maindata, revision counter, RID, and health.
 */
export interface MaindataSnapshotResponse {
  session_generation: number;
  server_id: string | null;
  revision: number;
  rid: number;
  health: MaindataSyncHealth;
  maindata: MaindataSnapshotEnvelope;
}

/**
 * Lightweight sync-changed event payload.
 * Emitted on maindata-sync-changed whenever sync state or health transitions.
 * Mirrors qb_core::sync::MaindataSyncChangedEvent.
 *
 * The optional `delta` field carries the raw qBittorrent maindata delta
 * (e.g. `torrents`, `categories`, `tags`, `server_state`,
 * `torrents_removed`) when Rust embeds it under the size threshold.
 * React consumers should prefer the embedded delta over a snapshot fetch
 * to avoid the IPC round-trip; `null` (or absence on older backends)
 * signals a fallback to `getMaindataSnapshot()`.
 */
export interface MaindataSyncChangedEvent {
  server_id: string | null;
  session_generation: number;
  revision: number;
  rid: number;
  health: MaindataSyncHealth;
  changed_resources: string[];
  delta: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Workspace view types (P2.3-TS)
//
// These types mirror the Rust-owned `qb_core::workspace::WorkspaceViewRequest`
// and `qb_core::workspace::WorkspaceView` structs serialized by the
// `set_workspace_view` / `get_workspace_view` Tauri commands and the
// `workspace-view-changed` event. Wire field names use snake_case to match
// the Rust serde output and the existing `MaindataSnapshotResponse` /
// `MaindataSyncChangedEvent` convention.
//
// Renderer adoption (P2.4) is intentionally out of scope for this bridge
// layer: consumers branch on `bridge.capabilities.supportsWorkspaceViewRust`
// to decide whether to consume Rust events or fall back to the JS
// derivation pipeline.
// ---------------------------------------------------------------------------

/**
 * Filter dimension for the workspace view request.
 *
 * `category` / `tag` / `tracker` use a tri-state string to mirror the Rust
 * `Option<String>`: `null` = no filter, `""` = uncategorized only,
 * `Some(name)` = exact match. `status` is a free-form string to match the
 * bridge contract (the engine normalizes to the canonical
 * `TORRENT_STATES_FOR_FILTER` table). `search` is a free-text substring
 * matched case-insensitively against `name` after `[._-]` → space
 * normalization (same behavior as the JS path).
 */
export interface WorkspaceViewFilters {
  /** qBittorrent filter status (`"all"`, `"downloading"`, …). */
  status: string;
  /** `null` = no filter, `""` = uncategorized only, `"name"` = exact match. */
  category: string | null;
  /** Exact tag match against the comma-separated `tags` string. */
  tag: string | null;
  /** Case-insensitive exact match on `tracker`. */
  tracker: string | null;
  /** Case-insensitive substring match on `name` (normalized `[._-]` → space). */
  search: string;
}

/**
 * Sort specification for the workspace view request.
 *
 * `field` is one of the 35 supported sort field names (see
 * `qb_core::workspace::sort`). `direction` mirrors `SortDirection`.
 */
export interface WorkspaceViewSort {
  /** Sort field name (35 supported values). */
  field: string;
  /** Sort direction. */
  direction: 'asc' | 'desc';
}

/**
 * Input request for the workspace view engine.
 * Mirrors `qb_core::workspace::WorkspaceViewRequest`.
 *
 * `request_id` is echoed back on the output `WorkspaceView` so the renderer
 * can correlate async responses with its in-flight request. `locale` is
 * the renderer's preferred locale (e.g. `"en-US"`, `"zh-CN"`); the engine
 * uses it for the string-sort collator with a root-collation fallback on
 * parse failure.
 */
export interface WorkspaceViewRequest {
  /** Renderer-assigned request id, echoed back on the response. */
  request_id: string;
  /** Filter dimensions (status/category/tag/tracker/search). */
  filters: WorkspaceViewFilters;
  /** Sort field and direction. */
  sort: WorkspaceViewSort;
  /**
   * When false, Rust skips collecting/sorting `sorted_hashes` and returns an
   * empty list while still computing counts, totals, and sidebar facets.
   */
  include_sorted_hashes: boolean;
  /** Renderer locale (e.g. `"en-US"`, `"zh-CN"`). Used by the string-sort collator. */
  locale: string;
}

/**
 * Sidebar category row from `WorkspaceView.sidebar_categories`.
 * Mirrors `qb_core::workspace::SidebarCategoryItem`.
 */
export interface WorkspaceViewSidebarCategory {
  /** Category name. Empty string represents the uncategorized bucket. */
  name: string;
  /** qBittorrent-declared save path (empty for the uncategorized bucket). */
  save_path: string;
  /** Cross-filtered count. */
  count: number;
}

/**
 * Sidebar tag row from `WorkspaceView.sidebar_tags`.
 * Mirrors `qb_core::workspace::SidebarTagItem`.
 */
export interface WorkspaceViewSidebarTag {
  /** Tag name. */
  tag: string;
  /** Cross-filtered count. */
  count: number;
}

/**
 * Sidebar tracker row from `WorkspaceView.sidebar_trackers`.
 * Mirrors `qb_core::workspace::SidebarTrackerItem`.
 */
export interface WorkspaceViewSidebarTracker {
  /** Tracker URL (the cross-filtered count key). */
  tracker_url: string;
  /** Extracted hostname (used for sidebar sorting/display). */
  hostname: string;
  /** Cross-filtered count. */
  count: number;
}

/**
 * Output projection for the workspace view engine.
 * Mirrors `qb_core::workspace::WorkspaceView`.
 *
 * The torrent list side is intentionally hash-only when requested:
 * `sorted_hashes` is the filtered/sorted torrent identifiers and the renderer
 * maps each hash back to a typed `Torrent` row via the upstream
 * `maindataState.torrents` store. Hashless requests return an empty
 * `sorted_hashes` array while still returning counts and sidebar facets.
 */
export interface WorkspaceView {
  /** Echoes the request id from `WorkspaceViewRequest`. */
  request_id: string;
  /** Snapshot revision (RID) the view was computed from. */
  revision: number;
  /** Hashes in sorted/filtered order. */
  sorted_hashes: string[];
  /** Number of torrents passing all active filters. */
  filtered_count: number;
  /** Total torrents in the snapshot. */
  total_count: number;
  /** Sum of `dlspeed` over every torrent (unfiltered). */
  total_dl_speed: number;
  /** Sum of `upspeed` over every torrent (unfiltered). */
  total_ul_speed: number;
  /** Status bucket counts over all torrents (unfiltered). */
  status_counts: Record<string, number>;
  /** Category counts; honors status/tag/tracker/search, ignores category. */
  category_counts: Record<string, number>;
  /** Tag counts; honors status/category/tracker/search, ignores tag. */
  tag_counts: Record<string, number>;
  /** Tracker counts; honors status/category/tag/search, ignores tracker. */
  tracker_counts: Record<string, number>;
  sidebar_categories: WorkspaceViewSidebarCategory[];
  sidebar_tags: WorkspaceViewSidebarTag[];
  sidebar_trackers: WorkspaceViewSidebarTracker[];
  /** True when any filter dimension is non-default. */
  is_filtered: boolean;
}

export interface RSSRulesResponse {
  session_generation: number;
  server_id: string | null;
  rules: RssRule[];
}

export interface SetCookiesInput {
  url: string;
  cookies: string;
}

/**
 * Write payload for creating or updating an RSS auto-download rule.
 * Server-owned/read-only fields (`lastMatch`, `previouslyMatchedEpisodes`) are excluded.
 */
export interface RssRuleInput {
  /** Whether the rule is enabled. */
  enabled?: boolean;
  /** Must-contain string (supports regex when useRegex=true). */
  mustContain?: string;
  /** Must-not-contain string (supports regex when useRegex=true). */
  mustNotContain?: string;
  /** Treat mustContain/mustNotContain as regular expressions. */
  useRegex?: boolean;
  /** Episode filter expression (e.g. "1x01-;"). */
  episodeFilter?: string;
  /** Enable smart episode filter. */
  smartFilter?: boolean;
  /** Assign downloads to this category. */
  assignedCategory?: string;
  /** Save path override for matched downloads. */
  savePath?: string;
  /** Minimum interval in days between two episodes of the same show. */
  ignoreDays?: number;
  /** Add matched downloads in paused state; null = use global default. */
  addPaused?: boolean | null;
  /** List of feed URLs this rule applies to (empty = all feeds). */
  affectedFeeds?: string[];
}

// ---------------------------------------------------------------------------
// Search DTO types (T141.3)
//
// These interfaces mirror the Rust-owned `qb_core::dto::Search*Dto` types
// serialized by the `get_search_status`, `get_search_results`, and
// `get_search_plugins` Tauri commands. The Rust command boundary owns the
// validation and shape contract; the bridge exposes the typed payload
// directly to consumers (no `unknown` coercion).
// ---------------------------------------------------------------------------

/**
 * Single search status object from `GET /api/v2/search/status`.
 * Mirrors `qb_core::dto::SearchStatusDto`.
 *
 * Wire field names use snake_case. `error` is only present when the
 * search engine reported a failure (Rust skips serialization when `None`).
 */
export interface SearchStatus {
  id: number;
  status: string;
  total: number;
  error?: string;
}

/**
 * Single search result row from `GET /api/v2/search/results`.
 * Mirrors `qb_core::dto::SearchResultDto`.
 *
 * Wire field names are camelCase (`descrLink`, `fileName`, `fileSize`,
 * `fileUrl`, `nbLeechers`, `nbSeeders`, `siteUrl`) — preserved as-is on
 * the bridge boundary so consumers can destructure the same keys that
 * the Rust DTO emits.
 */
export interface SearchResult {
  descrLink: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  nbLeechers: number;
  nbSeeders: number;
  siteUrl: string;
}

/**
 * Wrapper response from `GET /api/v2/search/results`.
 * Mirrors `qb_core::dto::SearchResultsDto`.
 */
export interface SearchResults {
  results: SearchResult[];
  total: number;
}

/**
 * Single supported category of a search plugin.
 * Mirrors `qb_core::dto::SearchPluginCategoryDto`.
 */
export interface SearchPluginCategory {
  id: string;
  name: string;
}

/**
 * Single plugin object from `GET /api/v2/search/plugins`.
 * Mirrors `qb_core::dto::SearchPluginDto`.
 *
 * `supportedCategories` is omitted from the wire when the plugin has
 * no supported categories (Rust `skip_serializing_if = "Vec::is_empty"`).
 */
export interface SearchPlugin {
  name: string;
  fullName: string;
  version: string;
  enabled: boolean;
  url: string;
  supportedCategories?: SearchPluginCategory[];
}
