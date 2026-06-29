import type { ReactNode } from 'react';
import type { Torrent, TorrentProperties } from '@taurent/shared';

export interface TorrentDetailHeaderProps {
  torrent: Torrent;
  properties: TorrentProperties | null;
  /** Status-colored class for the progress bar, e.g. 'bg-success' */
  progressBarClass: string;
  /** Render category/tag pills. Receives torrent data. */
  renderBadges?: (torrent: Torrent) => ReactNode;
}
