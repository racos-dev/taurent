// Bridge capability descriptors — lets consumers query supported features
// without guessing or duplicating platform-specific knowledge.

/**
 * Capability flags that describe what operations a bridge platform supports.
 * Consumers (web-core, app code) use these to conditionally enable or disable
 * features without hardcoding platform assumptions.
 */
export interface BridgeCapabilities {
  /** Desktop supports updateServerCredentials via servers.updateCredentials */
  supportsCredentialsUpdate: boolean;
  /**
   * Rust-owned workspace view projection (P2.3-TS).
   *
   * When `true`, the bridge exposes `setWorkspaceView` / `getWorkspaceView` /
   * `addWorkspaceViewListener` and the renderer may consume the Rust-owned
   * `workspace-view-changed` event instead of running the JS derivation
   * pipeline (`deriveTorrentList`, `torrentFilter`, `sortTorrents`).
   *
   * Mobile shares the same Rust path — Tauri mobile builds have the same
   * `qb-core` engine compiled in, so the capability is enabled on both
   * desktop and mobile while the JS fallback remains the default during
   * the staged rollout.
   */
  supportsWorkspaceViewRust: boolean;
}

/**
 * Desktop bridge static capabilities.
 */
export const DESKTOP_CAPABILITIES: BridgeCapabilities = {
  supportsCredentialsUpdate: true,
  supportsWorkspaceViewRust: true,
};

/**
 * Mobile bridge static capabilities.
 */
export const MOBILE_CAPABILITIES: BridgeCapabilities = {
  supportsCredentialsUpdate: false,
  supportsWorkspaceViewRust: true,
};
