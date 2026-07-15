# packages/web-ui/src/components/dialogs/SpeedLimitsModal/

## Responsibility

A controlled modal dialog for viewing and editing qBittorrent transfer speed limits (download/upload). It renders two `NumberInput` fields (configured in bytes-per-second unit mode, defaulting to KB), displays "Set" and "Cancel" action buttons, and commits the new limits via the parent's mutation callback. It is a pure presentational component with no direct access to the bridge, Tauri, or qBittorrent API.

## Design

- **Thin, memoised shell**: `SpeedLimitsModal` is `React.memo`'d and receives all data and callbacks through props (`SpeedLimitsModalProps`). It holds no side effects or data-fetching logic.
- **Local editing state**: Uses two `useState` hooks (`dlValue`, `ulValue`) initialised from the incoming `downloadLimit`/`uploadLimit` prop. Changes are accumulated locally and only flushed when the user clicks "Set".
- **Composition over configuration**: Built from three shared primitives — `Dialog`, `NumberInput`, and `DialogActions`. The `NumberInput` is configured with `unitMode="bytes-per-second"` and `unitDefault="kb"`, allowing the user to type in human-friendly units (KB/s, MB/s) while the component manages raw byte values internally.
- **Zero-unlimited convention**: A hint label ("Use 0 for unlimited") communicates the qBittorrent convention that a limit of `0` means unrestricted.
- **Consistent dialog pattern**: Follows the same pattern as other dialogs in the codebase: `Dialog` wraps content, `DialogActions` renders the primary/secondary buttons, the `onCancel` callback is wired to both the close button and the "Cancel" action.

## Flow

```
Parent (e.g. HomeScreen via @taurent/web-core)
  │
  │  Reads current limits from server_state via useMaindataSelector
  │  (dl_rate_limit, up_rate_limit → 0 if absent)
  │
  ├──→ SpeedLimitsModal
  │     downloadLimit={currentDlLimitBytes}
  │     uploadLimit={currentUlLimitBytes}
  │     onSubmit={handleSetSpeedLimits}
  │     onCancel={() => setShowSpeedLimitsModal(false)}
  │
  │  1. User edits download/upload fields (local useState)
  │  2. User clicks "Set"
  │     └──→ onSubmit(dlValue, ulValue) → parent callback
  │  3. User clicks "Cancel" or dialog X
  │     └──→ onCancel() → parent hides modal
  │
  Parent (handleSetSpeedLimits)
  │  Sets qBittorrent preferences via setPreferencesMutation
  │  (keys: dl_limit / alt_dl_limit, up_limit / alt_up_limit
  │   depending on whether alt speed mode is active)
  │
  ├──→ on success: toast.success + close modal
  └──→ on error:   toast.error with formatted message
```

## Integration

- **Exported** via `packages/web-ui/src/index.ts` (line 133) as both the component and its props type.
- **Consumers**: Currently used only in `apps/mobile/src/screens/HomeScreen.tsx`. The dialog is displayed when the user long-presses the alternative speed limits button. Desktop (`apps/desktop`) does not yet use this component.
- **Data source**: Receives current speed limits from the parent, which reads them from the qBittorrent `server_state` (via `useMaindataSelector` — fields `dl_rate_limit` and `up_rate_limit`).
- **Mutation path**: The `onSubmit` callback triggers `setPreferencesMutation.setPreferences(...)` which reaches the Rust backend through `@taurent/bridge`.
- **UI dependencies**: `Dialog` (dialog shell), `NumberInput` (unit-aware byte input), `DialogActions` (action buttons) — all from sibling/peer directories inside `packages/web-ui`.
- **Platform note**: The component itself is platform-agnostic. It has no `@tauri-apps/*` import and no platform-specific branch, making it safe for use in both desktop and mobile apps without modification.
