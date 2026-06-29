// Pure derivation utility for tracker entries from a torrent list.
// Canonical implementation used by both mobile and desktop filter screens.

import type { Torrent } from '../types/qbittorrent';

/** A derived tracker entry with hostname, URL, and torrent count. */
export interface TrackerEntry {
  trackerUrl: string;
  hostname: string;
  count: number;
}

/**
 * Derives tracker entries from a list of torrents.
 * - Skips empty/whitespace-only tracker URLs
 * - Derives hostname via `new URL(trackerUrl).hostname`, falling back to raw URL on parse failure
 * - Counts torrents per full tracker URL
 * - Sorts by count descending, then hostname ascending
 */
export function deriveTrackerEntries(torrents: Torrent[]): TrackerEntry[] {
  const trackerCounts = new Map<string, TrackerEntry>();

  for (const torrent of torrents) {
    const trackerUrl = torrent.tracker?.trim();
    if (!trackerUrl) continue;

    let hostname: string;
    try {
      hostname = new URL(trackerUrl).hostname;
    } catch {
      hostname = trackerUrl;
    }

    const existing = trackerCounts.get(trackerUrl);
    if (existing) {
      existing.count += 1;
    } else {
      trackerCounts.set(trackerUrl, { trackerUrl, hostname, count: 1 });
    }
  }

  return Array.from(trackerCounts.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.hostname.localeCompare(b.hostname);
  });
}
