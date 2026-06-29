# packages/web-ui/src/screens/TorrentDetailScreen/

## Responsibility

Provides the platform-agnostic presentational body for the single-torrent detail screen. Renders a header (TorrentItem on mobile, TorrentDetailHeader on desktop), action bar with primary/secondary actions, tabbed content (Overview, Trackers, Peers, Files), and multiple modal dialogs (delete, speed limit, file priority, rename, relocate, add tracker). All state and handlers are injected via props.

## Design

- **`TorrentDetailScreenBody`** — top-level `React.memo` component (`TorrentDetailScreenBodyProps`). ~420 lines composing many sub-components.
- **Tab system** — `TabBar` with pill variant; tabs defined as constant `TABS` array (`['overview', 'trackers', 'peers', 'files']`). Active tab controlled externally (`activeTab` / `setActiveTab`).
- **Mobile vs desktop header** — when `isMobile` is true, renders `TorrentItem` as a standalone card; otherwise renders `TorrentDetailHeader` with progress bar and stat grid.
- **Action bar** — uses `TorrentActionsBar` with primary actions (Pause/Resume, Delete) and scrollable secondary action chips (Force Start, Recheck, Announce, DL/UL Limit, Rename, Relocate, Queue Up/Down).
- **File preview limit** — `FILE_PREVIEW_LIMIT = 50`; files tab shows "Show all" toggle when file count exceeds this.
- **Dialog state** — all dialogs are controlled by external state flags (`showDeleteDialog`, `speedLimitModal`, `filePriorityDialog`, `showRenameDialog`, `showRelocateDialog`, `showAddTracker`).
- **Types module** — `DetailTab` union type, `TorrentDetailScreenBodyProps` interface with ~60 props covering torrent data, loading states, dialog state, action handlers, and pending flags.

## Flow

1. Controller provides `torrent`, `properties`, `files`, `trackers`, `peers` data + loading/error states per section.
2. User switches tabs → `setActiveTab(tab)` → controller may lazily refetch section data.
3. User taps Pause/Resume → `handlePauseResume()` → controller fires mutation; `pauseResumeIsPending` disables button and shows pending label.
4. User taps Delete → `openDeleteDialog()` → `DeleteTorrentDialog` renders → confirm → `handleDelete(deleteFiles)`.
5. Speed limit / Rename / Relocate → modal opens with current value → user edits → submit → controller mutation.
6. File priority → `openFilePriorityDialog(file)` → `FilePriorityDialog` → submit priority.
7. Add tracker → toggle textarea → submit → `handleAddTrackerSubmit()`.

## Integration

- **`@taurent/web-ui`** — `TorrentDetailHeader`, `ActionButton`, `ActionChip`, `TorrentActionsBar`, `DeleteTorrentDialog`, `NumberInputModal`, `FilePriorityDialog`, `InputDialog`, `Pill`, `TabBar`, detail section components (`TorrentDetailsOverviewSection`, `TorrentDetailsTrackersSection`, `TorrentDetailsFilesSection`, `TorrentDetailsPeersSection`).
- **`@taurent/shared`** — `Icon`.
- **HomeScreen** — imports `TorrentItem` for mobile header rendering.
- **Controller layer** — all action handlers (`handlePauseResume`, `handleRecheck`, etc.) and dialog open/close helpers are injected; controller owns React Query mutations.
- **Exported from `index.ts`**: `TorrentDetailScreenBody`, `TorrentDetailScreenBodyProps`.
