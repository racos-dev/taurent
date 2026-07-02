# torrent-detail

## Responsibility

Headless controller for TorrentDetailScreen orchestration. Manages tab state, file sorting/preview, action handlers, dialog state, tracker-add flow, peer-add flow, and delete/back navigation callbacks.

## Key Files

- `useTorrentDetailController.ts` — Main controller hook with tab management, file preview, dialog state, action handlers, tracker add flow, and peer add flow. Also exports `parsePeerList()` for parsing free-form `host:port` peer input.

## Design Patterns

- **Tab state**: Manages `activeTab` (overview, trackers, peers, files, httpSources)
- **File preview**: Sorts files (incomplete first, then alphabetical), limits to 50 visible files with show-all toggle
- **Dialog state**: Manages delete, speed limit, file priority, rename, relocate dialogs with open/close/value helpers
- **Tracker add flow**: Inline toggle for add-tracker form with URL input and submit
- **Peer add flow**: Inline toggle for add-peer form; parses free-form `host:port` input (comma/newline/space separated, de-duplicated, port required) via `parsePeerList()` and submits through the optional `addPeersMutation`
- **Action handlers**: Wraps all torrent action mutations (pause/resume, recheck, reannounce, force start, speed limit, file priority, rename, relocate, delete, priority, ban peer) with pending guards and error logging
- **Derived pending flags**: Computes individual pending states for each action type (pauseResumeIsPending, recheckIsPending, etc.)
- **Force-start awareness**: Pause/resume handler checks `force_start` flag and offers to clear it via `setForceStart(false)`

## Flow

1. App route mounts controller with hash, torrent, files, actions, mutations
2. Controller derives isPaused, currentDownloadLimit, currentUploadLimit from torrent data
3. Sorted files computed via `sortFiles()` (incomplete first)
4. User interacts with tabs, dialogs, actions
5. Action handlers call injected mutations with appropriate variables
6. Delete handler calls `onNavigateBack()` after successful deletion

## Integration

- Imports `TorrentFile` from `@taurent/shared/types/qbittorrent`
- Uses `DetailTab` type exported for `useSelectedTorrentDetailSync` coordination
- Used by desktop/mobile TorrentDetailScreen routes
- Consumes injected action mutations from `useTorrentActionController`
- Consumes `addTrackerMutation`, `banPeersMutation`, and `addPeersMutation` from hooks
