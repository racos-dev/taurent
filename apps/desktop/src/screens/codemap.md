# apps/desktop/src/screens/

## Responsibility

Route-level screen components for the desktop application. Each screen is a full-page view mounted by the router — either in the main window, an auxiliary window, or a dialog host window. Screens compose shared web-ui body components with desktop-specific data wiring.

## Design

- **Controller/body pattern**: Each screen uses a controller hook from `@taurent/web-core` (e.g. `useAddTorrentScreenController`, `useFiltersScreenController`, `useLoginScreenController`) for form state and orchestration, then passes it to a shared body component from `@taurent/web-ui`.
- **Window-variant awareness**: Some screens (e.g. `AddTorrentScreen`) accept a `variant` prop to behave differently in main-window vs auxiliary-window context (close window vs navigate back).
- **Search-param payload**: Dialog screens read their configuration from URL search params (e.g. `hashes`, `type`, `value`), which are set by the window opener via Tauri events.
- **Desktop-specific extensions**: `AddTorrentScreen` uses `pickTorrentFiles()` from the platform module for native file picker; `FiltersScreen` opens confirm dialogs as separate windows instead of in-app overlays.
- **Settings staged/baseline model**: `SettingsScreen` maintains per-section `baseline` and `stagedRemotes` state, using `isSectionDirty` / `getDirtyFieldKeys` from `@taurent/shared/settings` for dirty tracking. Supports scroll-to-section anchoring, deep-link via `?section=` param, Tauri `scrollToSection` events, and a floating unsaved-changes bar with Save All / Discard All.
- **Dialog screens**: `ConfirmDialogScreen`, `TorrentDeleteDialogScreen`, `TagSelectDialogScreen` read payloads from URL search params, call `BridgeAdapter` mutations, emit `resource-invalidated` events, and dismiss via `dismissDialogWindow`.

## Key Files

- **HomeScreen.tsx** — Main torrent list view. Wires `useTorrentWorkspaceListController`, selection store, context menu, and `TorrentTable`.
- **LoginScreen.tsx** — Server selection and connection screen. Uses `useLoginScreenController` for server selection/delete flows.
- **AddTorrentScreen.tsx** — Add torrent by magnet URI or file. Unified mode for both sources. Opens as auxiliary window.
- **AddServerScreen.tsx** — Add new qBittorrent server. Uses `useAddServerScreenController` with `addServer`, `switchServer`, `connect` for post-add flow.
- **SettingsScreen.tsx** — Settings panel with remote preferences, local settings, staged/baseline dirty tracking, scroll anchoring, and close confirmation overlay. Uses `isSectionDirty` / `getDirtyFieldKeys` from `@taurent/shared/settings` for dirty detection.
- **DialogHostScreen.tsx** — Dynamic dialog host that renders the appropriate dialog screen based on the `dialog` search param.
- **ConfirmDialogScreen.tsx** — Delete category/tag confirmation dialog. Reads `name` and `type` from search params, calls `BridgeAdapter.categories.removeCategories` or `BridgeAdapter.tags.deleteTags`.
- **TorrentDeleteDialogScreen.tsx** — Delete torrent(s) with optional file deletion. Reads `hashes` and `count` from search params.
- **TorrentNumericDialogScreen.tsx** — Set download/upload speed limits for torrents.
- **TorrentTextDialogScreen.tsx** — Rename torrent or set download location.
- **TorrentShareLimitsDialogScreen.tsx** — Set per-torrent ratio/seeding time limits.
- **TransferLimitDialogScreen.tsx** — Set global transfer speed limits (single or combined direction).
- **CategorySelectDialogScreen.tsx** — Assign category to selected torrents.
- **TagSelectDialogScreen.tsx** — Add/remove tags on selected torrents. Uses `useLiveTorrentByHash` for single-torrent tag display, tracks add/remove pending states independently.
- **CreateDialogScreen.tsx** — Create new category or tag.
- **EditCategoryDialogScreen.tsx** — Edit category save path.
- **FiltersScreen.tsx** — Filter configuration with status, category, tag, and tracker filters.
- **SearchScreen.tsx** — Torrent search with plugin management.
- **RSSScreen.tsx** — RSS feed management and auto-downloading rules.

## Flow

1. Router in `App.tsx` maps routes to screen components.
2. Main-window routes: `HomeScreen`, `LoginScreen`, `AddTorrentScreen` (variant=main), `FiltersScreen`, `SearchScreen`, `RSSScreen`.
3. Auxiliary-window routes: `AddTorrentScreen` (variant=aux), `SettingsScreen`, `StatisticsScreen`.
4. Dialog-host route: `DialogHostScreen` renders dialog screens dynamically via registry lookup.

## Integration

- Screens import hooks from `../hooks/` for domain-specific data.
- Screens import `BridgeAdapter` from `@taurent/bridge/adapters/desktop` for direct API calls in dialog screens.
- Shared body components come from `@taurent/web-ui`.
- Controllers come from `@taurent/web-core`.
- Window management functions come from `../windows/`.
- Dialog screens emit `resource-invalidated` events after mutations to cross-window sync.
