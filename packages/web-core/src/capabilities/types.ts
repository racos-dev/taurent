/**
 * Application-level capabilities (camelCase, non-nullable boolean).
 *
 * Mirrors the Rust-resolved `ResolvedCapabilities` shape (snake_case from
 * `@taurent/bridge` `ServerCapabilities`) but normalized to camelCase and
 * non-nullable for the web-core / web-ui layers. Capabilities arrive as
 * part of every `SessionSnapshot` (`session.capabilities`) so consumers
 * never have to null-check this type — when the session is disconnected,
 * the QBClient context defaults the object to `{ all false }`.
 *
 * Note: `supportsPauseResume` is intentionally NOT here — it is resolved
 * inside Rust by `qb-tauri::commands::torrent::*` to gate individual
 * torrent pause/resume calls and does not flow through this struct.
 */
export interface AppCapabilities {
  supportsSearch: boolean;
  supportsRss: boolean;
  supportsWebSeedManagement: boolean;
}

/**
 * Default `AppCapabilities` value used when no session snapshot is
 * available (e.g. disconnected, hydrating). Treat as "everything
 * unsupported" — feature controllers guard with `isConnected` separately.
 */
export const DEFAULT_APP_CAPABILITIES: AppCapabilities = {
  supportsSearch: false,
  supportsRss: false,
  supportsWebSeedManagement: false,
};

/**
 * Maps the snake_case `ServerCapabilities` from `@taurent/bridge` (the
 * wire shape that mirrors Rust's `ResolvedCapabilities`) into the
 * camelCase `AppCapabilities` consumed by the web-core / web-ui layers.
 *
 * Field renames only — no value coercion needed because both shapes use
 * non-nullable booleans.
 */
export function toAppCapabilities(
  capabilities: import('@taurent/bridge').ServerCapabilities,
): AppCapabilities {
  return {
    supportsSearch: capabilities.supports_search,
    supportsRss: capabilities.supports_rss,
    supportsWebSeedManagement: capabilities.supports_webseed_management,
  };
}
