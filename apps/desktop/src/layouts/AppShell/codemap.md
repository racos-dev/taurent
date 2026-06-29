# apps/desktop/src/layouts/AppShell/

## Responsibility

Provides the main application layout: a workspace frame composed of a menu bar, sidebar rail, content area with optional detail panel, and a status bar footer. Additionally handles server-connection overlays, drag-and-drop UI feedback, sidebar resizing, and query cache cleanup on server change.

## Design

- **WorkspaceFrame composition**: The shell is a vertical stack of `WorkspaceFrame` from `@taurent/web-ui` with named slots: `header` (MenuBar + MainToolbar), `rail` (Sidebar), `content` (children route + DetailPanel), `footer` (StatusBar).
- **Maindata mirroring**: Categories and tags from maindata are mirrored into Zustand stores (`useTorrentStore`) for sidebar filtering and context menus.
- **Connection overlay**: `ConnectedServerUnavailableOverlay` takes over the full viewport when maindata sync or protected requests are degraded, with an auto-dismiss on recovery.
- **Sidebar resize**: Handles drag-to-resize on the sidebar rail, persisting width to shellStore.
- **Cache cleanup**: Clears React Query caches when the active server changes to prevent stale data from the previous connection.

## Files

- **AppShell.tsx** — main layout component. Renders `WorkspaceFrame` with `MenuBar` + `MainToolbar` in the header, `Sidebar` in the rail, route children + `DetailPanel` in the content area, and `StatusBar` in the footer. Mirrors categories and tags from maindata to Zustand. Handles drag-drop overlay, sidebar resize via pointer events, and query cache invalidation on server change.
- **ConnectedServerUnavailableOverlay.tsx** — full-window overlay shown when the connected server is unreachable (maindata sync failed or protected requests are degraded). Auto-dismisses when connectivity recovers. Exposes an "Open Servers" action button for quick navigation.

## Flow

1. `AppShell` mounts, subscribes to maindata, and mirrors categories/tags into Zustand stores.
2. User interactions (resize sidebar, drag files, navigate routes) are handled within the shell.
3. When the server connection degrades, `ConnectedServerUnavailableOverlay` renders above the workspace, blocking interaction.
4. When the user changes servers, query caches are cleared and the shell re-initializes for the new connection.
5. Drag-and-drop events from `useDragAndDrop` control the drag overlay visibility.

## Integration

- `@taurent/web-ui` — `WorkspaceFrame` layout component and `MainToolbar`, `DetailPanel` components.
- `@taurent/shared/stores` — `useTorrentStore`, `useMaindataSelector` for categories, tags, torrents.
- `src/layouts/MenuBar` — `MenuBar` component in header slot.
- `src/layouts/Sidebar` — `Sidebar` component in rail slot.
- `src/layouts/StatusBar` — `StatusBar` component in footer slot.
- `hooks/platform/useDragAndDrop` — drag state for overlay.
- `hooks/shell/useShellPersistence` — sidebar width persistence.
- `contexts` — `useQBClient` for server identity and connection state.
