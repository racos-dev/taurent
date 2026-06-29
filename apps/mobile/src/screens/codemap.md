# apps/mobile/src/screens/

## Responsibility

All screen-level route components for the mobile app. Each screen is a thin "shell" that:

- Owns route-specific parameter parsing and navigation glue.
- Wires platform hooks (`useQBClient`, `useTorrentActions`, etc.) and web-core screen controllers to shared presentational body components from `@taurent/web-ui`.
- Handles loading, error, and empty states with `StateCard`.
- Renders a mobile-specific sticky translucent header with navigation controls.

## Key Files

- **HomeScreen.tsx** — Main torrent list screen. Manages URL-derived filter state, search input, sort preferences, multi-select, batch actions (delete, speed limits, category, tags), and the FAB menu for adding torrents. Passes all data/handlers to `HomeScreenBody` (web-ui). Handles long-press to enter selection mode.
- **LoginScreen.tsx** — Server list and connection/manage screen. Uses `useLoginScreenController` from web-core for server selection and deletion, and the server manager context for inline editing of saved server connection fields. Renders `ServerCard` list, credential warning banner, error banner, and "Add New Server" link. Redirects to `/` after selecting an already-connected server.
- **AddServerScreen.tsx** — Server creation form. Uses `useAddServerScreenController` from web-core. Combines test + submit into a single action: validate, test connection, then add on success. Renders `AddServerFormBody` (web-ui).
- **TorrentDetailScreen.tsx** — Torrent detail view with tabs (general, files, trackers, peers). Uses `useTorrentDetailController` from web-core. Wires torrent properties, files, trackers, peers hooks, plus add-tracker and ban-peers mutations. Renders `TorrentDetailScreenBody` (web-ui).
- **AddTorrentScreen.tsx** — Add torrent by magnet link or file. Uses `useAddTorrentScreenController` from web-core. Mobile file picker via `pickTorrentFiles`. Renders `AddTorrentScreenBody` (web-ui).
- **FiltersScreen.tsx** — Filter selection screen (status, category, tag, tracker). Uses `useFiltersScreenController` and `useFiltersFormState` from web-core. Enriches shared filter options with mobile icons. Renders `FiltersScreenBody` (web-ui).
- **SettingsScreen.tsx** — App and server settings. Uses `useSettingsScreenController` from web-core. Manages theme, remote preference edits, server editing, and remote shutdown. Renders the local `MobileSettingsScreenBody` because the mobile settings presentation is intentionally denser than the shared desktop-oriented body.
- **StatisticsScreen.tsx** — Server statistics display. Instantiates `createServerStatisticsHook` from web-core. Renders `StatisticsScreenBody` (web-ui).
- **SearchScreen.tsx** — Torrent search with plugins. Uses `useSearchScreenModel` from web-core. Wires all search adapter calls (start, stop, status, results, plugins) to `BridgeAdapter.qBClient`. Navigates to AddTorrentScreen with the result URL on selection. Renders `SearchScreenBody` (web-ui).
- **RSSScreen.tsx** — RSS feed management. Uses `useRssScreenModel` from web-core. Wires feed/rule CRUD to `BridgeAdapter.qBClient`. Renders `RSSScreenBody` (web-ui).

## Design Patterns

- **Shell/Body separation**: Every screen is a "thin shell" that handles route params, hooks, and navigation, then delegates all presentational composition to a shared `*Body` component from `@taurent/web-ui`. This is the primary architectural pattern — mobile screens own platform wiring; web-ui owns rendering.
- **Web-core controllers**: Business logic, state orchestration, dialog/modal state, and action handlers live in web-core screen controller hooks (e.g., `useHomeScreenController`, `useSettingsScreenController`, `useTorrentDetailController`). Mobile screens pass data into these controllers and receive back handlers + UI state.
- **Settings section adapter**: Settings uses final web-core section keys (`server`, `appearance`, `downloads`, `bittorrent`, etc.) and maps them to the shared body’s current compatibility keys while the web-ui prop contract is still being migrated.
- **Sticky translucent headers**: Each screen renders its own sticky header with `bg-background/90 backdrop-blur-lg` for the mobile translucency effect. Headers include back/close buttons and action buttons (clear, manage links). Header inner content uses `mobileScreenHeaderInnerClassName` for consistent width constraints.
- **Screen layout helpers**: All screens import `mobileScreenRootClassName`, `mobileScreenContentClassName`, and/or `mobileCenteredStateClassName` from `../ui/mobileScreenLayout` for safe-area-aware padding, width constraints, and centered-state layouts. This centralizes all spacing/safe-area concerns.
- **Error/loading states**: Screens use `StateCard` from web-ui for hydration, connection, error, and not-found states with appropriate icons and action buttons, rendered inside `mobileCenteredStateClassName` containers.

## Flow

1. Router matches a route (e.g., `/`) and renders the screen component (e.g., `HomeScreen`).
2. The screen reads route params (`useParams`, `useSearchParams`) and connection state (`useQBClient`).
3. The screen instantiates a web-core controller hook with bridge adapters and navigation callbacks.
4. The screen calls platform hooks (`useTorrents`, `useTorrentActions`, etc.) which invoke `BridgeAdapter` via React Query.
5. The screen passes all derived state and handlers to the shared `*Body` component.
6. The `*Body` component renders the UI using `@taurent/web-ui` components.

## Integration

- **@taurent/web-ui** — All `*Body` components, `StateCard`, `ScreenHeader`, `ConfirmDialog`, `ServerCard`, `CredentialWarningBanner`.
- **@taurent/web-core/screens** — Screen controller hooks (`useHomeScreenController`, `useLoginScreenController`, `useAddServerScreenController`, `useTorrentDetailController`, `useAddTorrentScreenController`, `useFiltersScreenController`, `useSettingsScreenController`, `useRssScreenModel`, `useSearchScreenModel`).
- **@taurent/web-core/hooks** — `useFiltersFormState`, `useRemoteShutdown`.
- **@taurent/bridge/adapters/mobile-tauri** — `BridgeAdapter` for direct adapter wiring in screens not covered by mobile hooks. Search, RSS, Settings, and TorrentDetail screens use dedicated hooks from `../hooks` instead.
- **../hooks/** — `useSearchScreen`, `useRssScreen`, `useTorrentDetailMutations`, `useRemoteShutdownMutation` — mobile-only bridge assembly hooks that wrap `BridgeAdapter` method calls and expose typed mutation objects. Route screens import these instead of `BridgeAdapter` directly.
- **../connection/** — `useQBClient`, `useMaindataState`, `useServerManager`.
- **../hooks/** — `useTorrents`, `useTorrentActions`, `useSelection`, `useSortPreference`, `useFilterState`, `useCategories`, `useTags`, `usePreferences`, `useTrackerEntries`, `useTorrentDetails`, `useAddTorrent`.
- **../ui/mobileScreenLayout** — `mobileScreenRootClassName`, `mobileScreenContentClassName`, `mobileScreenHeaderInnerClassName`, `mobileCenteredStateClassName` — layout helpers used by all screens for safe-area-aware padding and width constraints.
- **../ui/Icon** — Mobile `Icon` component for header and filter icons.
- **../platform** — `pickTorrentFiles` for the AddTorrentScreen file picker.
- **@taurent/shared** — Types, `isTorrentFilterType`, `TORRENT_FILTER_OPTIONS`, `formatUserMessage`, `getTorrentDisplayStatus`, `getStatusColorClass`.
- **react-router-dom** — `useNavigate`, `useParams`, `useSearchParams`, `Link`, `NavLink`.
