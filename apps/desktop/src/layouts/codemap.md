# apps/desktop/src/layouts/

## Responsibility

Provides layout components for the desktop application's main window. Contains the AppShell layout and its constituent parts: menu bar, toolbar, sidebar, main content area, status bar.

## Key Files

- **AppShell/AppShell.tsx** — Main layout composing all layout regions
- **MenuBar/MenuBar.tsx** — Application menu with File, Torrent, Tools, View, Help menus
- **Sidebar/Sidebar.tsx** — Left sidebar with status filters, categories, tags, trackers sections
- **StatusBar/StatusBar.tsx** — Bottom bar showing connection status, torrent counts, transfer speeds
- **index.ts** — Re-exports for layouts

## Design Patterns

- **Layout Composition**: AppShell composes MenuBar → MainToolbar → Sidebar → Content → DetailPanel → StatusBar
- **Section Pattern**: Sidebar uses SidebarSection for collapsible filter groups
- **Menu Semantics**: Uses MutationObserver to apply ARIA menu semantics after render

## Integration

- Imports torrent data from `@taurent/web-core/hooks` (useTorrentList)
- Uses `useQBClient()` for connection state
- Uses `useShellStore` from `@taurent/bridge/adapters/desktop` for layout preferences
- Uses `@taurent/shared/stores` (useTorrentStore, useUIStore)
- Renders components from `../components/` (MainToolbar, DetailPanel)
