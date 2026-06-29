# packages/web-ui/src/components/TorrentDetailsSections/

## Responsibility

Collection of torrent detail section components: Overview, Trackers, Files, Peers, and HttpSources. Each section displays torrent-specific data with loading/error states and platform variants. Includes `DesktopDetailTable`, a generic sortable data table used by the desktop peers and trackers sections.

## Key Files

- `TorrentDetailsOverviewSection.tsx` - Torrent info, properties, transfer stats (desktop: two-column KV grid; mobile: metadata list)
- `TorrentDetailsTrackersSection.tsx` - Tracker list with status
- `TorrentDetailsFilesSection.tsx` - File list with progress and priority
- `TorrentDetailsPeersSection.tsx` - Connected peers with speeds (uses `DesktopDetailTable`)
- `DesktopDetailTable.tsx` - Generic sortable data table with column definitions, sort indicators, row click/context menu, and active row highlighting
- `types.ts` - All props interfaces and shared types
- `index.ts` - Barrel export for all sections

## Design Patterns

- **Shared types**: Re-exports types from @taurent/shared (Torrent, TorrentProperties, Tracker, TorrentFile)
- **PeerRow interface**: Custom type for transformed peer data
- **SectionStateProps**: Shared loading/error/retry props for all sections
- **Platform variants**: Desktop uses `DesktopDetailTable` or flat KV grids, mobile uses cards/metadata lists
- **DesktopDetailTable**: Generic typed table component with column definitions (`id`, `label`, `width`, `renderCell`, `sortable`), sort state (`sortColumnId`, `sortDirection`), row click/context menu, and active row highlighting. Used by peers and trackers sections on desktop.
- **Loading skeletons**: Shows skeleton UI when loading
- **Error states**: Displays error message with optional retry button
- **Inline icons**: Multiple SVG icons for different stats
- **React.memo**: All section components memoized

## Integration

- Used in torrent detail screens
- Imports formatters from @taurent/shared/utils/formatters (formatBytes, formatSpeed, formatTime, formatRatio)
- Props include: torrent, properties, trackers, files, peers, isLoading, error, onRetry, variant
- Each section handles its own loading and error states
