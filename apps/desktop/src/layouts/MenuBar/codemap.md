# apps/desktop/src/layouts/MenuBar/

## Responsibility

Provides the application menu bar with standard desktop menus: File, Torrent, Tools, View, and Help. Renders accessible dropdown menus with keyboard navigation, platform-specific shortcut display, and command-driven item execution. macOS-aware with in-window menu bar toggle support.

## Design

- **Declarative menu structure**: Menu items are defined as arrays of objects with `label`, `shortcut`, `action`, and `enabled` fields, then rendered via `DropdownMenu` from `@taurent/web-ui`.
- **Platform shortcuts**: Detects macOS via `navigator.userAgent` and displays `⌘` instead of `Ctrl` in shortcut labels.
- **Command-driven actions**: Menu item actions are sourced from `useDesktopCommands` (app-level commands like `addTorrent`, `openSettings`, `exitApp`) and `useTransferCommandList` (torrent-level commands like `pause`, `resume`, `delete`).
- **Conditional enable**: Torrent menu items are disabled when no torrents are selected or when the action isn't applicable (e.g., Pause disabled when no running torrents are selected).
- **In-window toggle**: Supports toggling the in-window menu bar visibility, useful when the native OS menu bar is preferred.

## Files

- **MenuBar.tsx** — main menu bar component. Defines five menu groups (File, Torrent, Tools, View, Help) using `DropdownMenu`. File menu includes `addTorrent`, `openSettings`, and `exitApp`. Torrent menu includes all transfer commands (pause, resume, delete, recheck, force-start, queue operations, category/tag assignment). Tools menu includes `openStatistics` and navigation to Search/RSS. View menu includes menu bar toggle. Help menu includes about and documentation links.
- **index.ts** — barrel re-export of `MenuBar`.

## Flow

1. `MenuBar` renders a horizontal bar of `DropdownMenu` triggers.
2. On hover/click, `DropdownMenu` renders the item list with labels, shortcuts, and enabled states.
3. User clicks an item → the bound `action` callback fires (from `useDesktopCommands` or `useTransferCommandList`).
4. Enabled states are computed reactively: File menu items are always enabled when connected; Torrent menu items depend on selection state and torrent action availability.
5. macOS detection happens once at module scope — shortcut display adapts accordingly.

## Integration

- `@taurent/web-ui` — `DropdownMenu` component for dropdown rendering.
- `hooks/shell/useDesktopCommands` — app-level actions (addTorrent, openSettings, openStatistics, exitApp).
- `hooks/torrents/useTransferCommandList` — torrent-level commands (pause, resume, delete, recheck, etc.).
- `contexts` — `useQBClient` for connection state (controls File menu enable).
- Rendered inside `AppShell`'s header slot alongside `MainToolbar`.
