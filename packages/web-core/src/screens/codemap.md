# screens

## Responsibility

Shared screen controller hooks and screen models that compose hooks, mutations, sync sources, and derived state into UI-ready view models. Each screen directory contains a headless controller or model hook that is platform-agnostic (no `@tauri-apps/*` imports, no UI rendering).

## Key Files

- `index.ts` — Barrel export of all screen controllers/models

## Subdirectories

| Directory | Responsibility |
|-----------|---------------|
| `home/` | Home screen: batch torrent actions, desktop workspace (filter/sort/sidebar), mobile home controller |
| `add-server/` | Add server screen: form state, validation, scheme auto-detection, test connection, submit |
| `add-torrent/` | Add torrent screen: form state, magnet/file mode switching, validation, submit |
| `login/` | Login screen: server selection, delete dialog, connection status derivation |
| `settings/` | Settings screen: section expand state, server editing, transfer limits, theme summary, danger zone |
| `filters/` | Filters screen: filter selection state, section expand/collapse, confirm dialogs |
| `manage-categories/` | Manage categories screen: categories query + create/edit/remove mutations |
| `manage-tags/` | Manage tags screen: tags query + create/delete mutations |
| `torrent-detail/` | Torrent detail screen: tab state, file sorting/preview, action handlers, dialog state, tracker add flow |

## Design Patterns

- **Headless controllers**: Each screen hook owns state machine logic without rendering UI; app routes wire navigation and rendering
- **Factory pattern**: Some controllers use factory form (e.g., `createTorrentWorkspaceController`, `createMobileHomeController`) accepting a scopeProvider
- **Adapter injection**: Controllers accept injected functions (addServer, testServerConnection, connect, etc.) rather than importing bridges
- **Dialog/modal state**: Controllers own dialog open/close state and confirmation callbacks
- **Derived state**: Controllers compute derived values (isFormValid, isActionPending, hasActiveFilters, sectionSummaries)
- **Platform-specific callbacks**: `onSuccess`, `onError`, `onNavigateBack` etc. are injected so apps can wire their own navigation

## Flow

1. App route mounts and calls the screen controller hook with injected dependencies
2. Controller provides form state, derived values, and action handlers
3. App route renders UI using controller values and callbacks
4. User interactions trigger controller handlers which call injected mutations
5. Mutation success triggers navigation or state cleanup via injected callbacks

## Integration

- Imported by desktop/mobile app route files
- Compose hooks from `hooks/`, `torrents/`, `server/`, `sync/` directories
- Use `QueryScope` from `query/scope` for scoped queries
- Export typed interfaces consumed by web-ui screen body components
