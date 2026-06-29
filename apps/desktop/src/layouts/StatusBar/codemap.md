# apps/desktop/src/layouts/StatusBar/

## Responsibility

Provides the bottom status bar displaying connection status, torrent counts, free disk space, alternative speed toggle, and transfer speeds with click-to-edit global rate limits. Shows real-time aggregate statistics derived from maindata.

## Design

- **Maindata-driven**: All displayed data comes from `useMaindataSelector` querying `server_state` — no separate polling or subscriptions.
- **Click-to-edit**: Download and upload speed labels are clickable, opening a numeric input to set global rate limits via `useSetGlobalDownloadLimit` / `useSetGlobalUploadLimit`.
- **Speed formatting**: Uses `formatSpeed` from `@taurent/shared` to display human-readable speeds (B/s, KB/s, MB/s, GB/s).
- **Connection indicator**: Shows a colored dot (green for connected, yellow for connecting, red for disconnected) alongside a text label.
- **Alt speed toggle**: Displays whether alternative speed limits are active and provides a toggle via `useToggleSpeedLimitsMode`.

## Files

- **StatusBar.tsx** — main status bar component. Renders connection status dot + label, torrent count (filtered / total), free disk space, alt speed indicator + toggle, download speed (clickable), upload speed (clickable).
- **index.ts** — barrel re-export of `StatusBar`.

## Flow

1. `StatusBar` selects `server_state` from maindata via `useMaindataSelector`.
2. On every render, it derives: connection status, torrent counts, free space, alt speed state, download/upload speeds.
3. User clicks a speed label → inline numeric input appears for rate limit editing.
4. User clicks alt speed toggle → `useToggleSpeedLimitsMode` mutation fires.
5. All values update reactively as maindata ticks arrive.

## Integration

- `@taurent/shared/stores` — `useMaindataSelector` for `server_state`, `useTorrentStore` for torrents and filters.
- `@taurent/shared` — `formatSpeed`, `matchesTorrentFilter`.
- `hooks/platform/platform` — `useSetGlobalDownloadLimit`, `useSetGlobalUploadLimit`, `useToggleSpeedLimitsMode`.
- `contexts` — `useQBClient` for connection state (isConnected, isConnecting).
- Rendered by `AppShell` in the footer slot.
