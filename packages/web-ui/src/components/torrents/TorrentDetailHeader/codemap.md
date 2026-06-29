# packages/web-ui/src/components/torrents/TorrentDetailHeader/

## Responsibility

Renders the header section for a single-torrent detail view. Displays the torrent name, status badge, category/tag badges (via render prop), progress bar, size/ETA summary, and a 2-column stat grid (DL speed, UL speed, ratio, peers). Read-only presentational component.

## Design

- **`TorrentDetailHeader`** — `React.memo` component (`TorrentDetailHeaderProps`). ~91 lines.
- **Props**:
  - `torrent: Torrent` — the torrent data object.
  - `properties: TorrentProperties | null` — extended properties for fallback values (e.g., `total_downloaded`, `total_size`, `dl_speed`, `up_speed`, `share_ratio`).
  - `progressBarClass: string` — status-colored CSS class for the progress bar fill (e.g., `'bg-success'`).
  - `renderBadges?: (torrent: Torrent) => ReactNode` — render prop for category/tag pills, allowing parent to control which badges appear.
- **Status derivation** — uses `getTorrentDisplayStatus(torrent)` and `toStatusBadgeStatus()` for the `StatusBadge` component.
- **Progress** — computed as `torrent.progress * 100`, rendered as a thin bar with dynamic color class.
- **Stat grid** — 2-col on mobile, 4-col on `sm+`, each stat in a `bg-surface-interactive` rounded container with icon + label + value.

## Flow

1. Parent (`TorrentDetailScreenBody`) passes `torrent`, `properties`, `progressBarClass`, and `renderBadges`.
2. Component renders; no internal state or callbacks.

## Integration

- **`@taurent/shared`** — `formatBytes`, `formatSpeed`, `formatEta`, `formatProgress`, `formatRatio`, `Icon`, `StatusBadge`, `getTorrentDisplayStatus`, `toStatusBadgeStatus`.
- **Local components** — `Pill` (for progress percentage badge).
- **Used by** — `TorrentDetailScreenBody` (desktop mode).
- **Exported from `index.ts`**: `TorrentDetailHeader`, `TorrentDetailHeaderProps`.
