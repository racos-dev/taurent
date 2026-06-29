# apps/desktop/src/components/Toolbar/

## Responsibility

The main application toolbar rendered below the menu bar. Contains torrent action buttons (add, delete, resume, pause, force start, queue operations), sidebar toggle, settings button, search input, and view navigation tabs (Transfers, Search, RSS).

## Design

- **Command-driven buttons**: Action buttons derive their enabled/disabled state and click handlers from `useTransferCommandList()` commands. Each button maps to a `TransferCommand` by ID.
- **Search input**: Inline search field that updates `useTorrentStore`'s search filter. Uses the `SearchFocusContext` ref-callback for keyboard shortcut focus.
- **View navigation**: Right-aligned tab buttons for route navigation (Transfers `/`, Search `/search`, RSS `/rss`).
- **Platform awareness**: Shows in-window menu bar toggle button on macOS only (`isMacPlatform` check).

## Key Files

- **MainToolbar.tsx** — The full toolbar component.
- **ToolbarButton.tsx** — Individual toolbar button with icon, tooltip, and optional shortcut display.

## Flow

1. `AppShell` renders `MainToolbar` in the header region.
2. `MainToolbar` reads commands from `useTransferCommandList` and desktop commands from `useDesktopCommands`.
3. Button clicks invoke command `onClick` handlers or navigation functions.
4. Search input changes update the torrent store filter, which propagates to the torrent table.

## Integration

- Uses `useTransferCommandList` from `../hooks/torrents/useTransferCommandList` for action commands.
- Uses `useDesktopCommands` from `../hooks/shell/useDesktopCommands` for app-level actions (add torrent, settings).
- Uses `useShellStore` for sidebar and menu bar visibility toggles.
- Uses `useTorrentStore` for search filter state.
- Uses `usePreferences` to conditionally show queue-related buttons.
