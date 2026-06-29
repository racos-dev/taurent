# home

## Responsibility

Headless controllers for the home/torrent-list screen. Provides batch torrent action orchestration, desktop workspace (filter/sort/sidebar/speeds), and mobile home controller (sort summary/filter chips/result count).

## Key Files

- `useHomeScreenController.ts` — Batch torrent action controller: dialog state (delete, category, tags, speed limit), batch action handlers (delete, speed limit, category, tags, pause, resume, recheck, reannounce, priority)
- `createTorrentWorkspaceController.ts` — Desktop workspace factory: filtered/sorted torrent list, status counts, transfer speeds, sidebar view models (categories/tags/trackers with counts), filter/sort state and setters
- `createMobileHomeController.ts` — Mobile home factory: result count, sort label, non-default sort signal, filter summary chips

## Design Patterns

- **Factory pattern**: `createTorrentWorkspaceController`, `createTorrentWorkspaceSidebarController`, `createTorrentWorkspaceListController`, `createTorrentWorkspaceSummaryController`, `createMobileHomeController` all use factory form accepting a scopeProvider
- **Zustand integration**: Desktop workspace reads filter/sort state from `useTorrentStore` (Zustand) for reactive updates
- **Rust projection**: The AppShell-level workspace provider consumes `WorkspaceViewEngine` through the bridge and exposes the shared projection to narrow controllers.
- **Hashless projection**: Non-list routes disable `sorted_hashes` so Rust skips the filtered-hash sort while still returning counts and sidebar facets.
- **Narrow controllers**: Sidebar-only, list-only, and summary-only controllers expose minimal subsets without issuing independent workspace-view IPC calls.
- **Batch action handlers**: `useHomeScreenController` wraps mutations with pending guards and selection cleanup

## Flow

1. Desktop: `createTorrentWorkspaceViewProvider` reads live torrents from injected provider + filters/sort from Zustand store.
2. Rust `WorkspaceViewEngine` computes filtered/sorted hashes, counts, speeds, and sidebar facets.
3. Narrow desktop controllers read list/sidebar/status slices from the shared provider.
4. Mobile: `createMobileHomeController` receives pre-derived torrents and computes sort label + filter summary chips
5. `useHomeScreenController` manages batch action dialogs and handlers for selected torrents

## Integration

- Imports `useTorrentStore` from `@taurent/shared/stores` (Zustand)
- Imports the workspace view bridge contract from `@taurent/bridge`
- Imports `QBClientContextValue` from `session/`
- Used by desktop HomeScreen, mobile HomeScreen routes
- Composes with `useTorrentActionController` for batch operations
