# packages/web-ui/src/screens/

## Responsibility

Page-level body components for each major screen. Each body is a pure presentational component that renders the full page content given props — no routing, no data fetching, no state management beyond local UI state.

## Design

- **Prop-driven**: Every `*ScreenBody` accepts a comprehensive props interface with all data, loading states, error states, and callbacks. The parent app shell is responsible for wiring data sources.
- **Platform variants**: Some screens accept `variant?: 'desktop' | 'mobile'` to adjust layout density and interaction patterns (e.g., long-press on mobile vs. context menu on desktop).
- **Compose shared components**: Bodies use domain components from `components/` (e.g., `TorrentActionsBar`, `FilterStatusList`, `SettingsSection`, `TabBar`, `StateCard`, `StateSurface`).
- **Local UI state only**: Screens own ephemeral UI state (selected tab, expanded sections, dialog visibility) but never own domain data.

## Flow

Each screen body receives its full state tree as props from the app shell, renders the UI, and delegates user actions back via callbacks. Example:
1. `HomeScreenBody` receives `torrents[]`, `sortOptions`, `selectedFilter`, and callbacks like `onSelectTorrent`, `onDeleteTorrent`, `onSortChange`.
2. User interactions (click, sort, filter) call the callback props.
3. The app shell (not the screen body) updates state via React Query mutations and refetching.

## Integration

- Each screen body is exported from its `index.ts` barrel and re-exported from `src/index.ts`.
- Screen bodies import from `components/` for UI elements and from `@taurent/shared` for types, formatters, and utilities.
- The app shell (desktop/mobile) wraps screen bodies in routing, data fetching, and layout scaffolding.
