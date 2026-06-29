/**
 * Per-server path mapping utilities for desktop.
 * Translates server-side paths (e.g. /data/torrents/movie.mkv) to local paths
 * (e.g. //nas/torrents/movie.mkv) using user-configured mappings.
 */

/** Matches packages/bridge/src/types.ts PathMapping */
export interface PathMapping {
  serverPath: string;
  localPath: string;
}

/**
 * Returns the directory portion of a path (everything up to but not including the last segment).
 * Handles trailing slashes correctly. Normalizes mixed separators to `/` before scanning.
 */
export function dirname(path: string): string {
  const normalized = path.replace(/[\\/]+$/, '').replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash >= 0 ? normalized.substring(0, lastSlash) : normalized;
}

/**
 * Returns the last segment of a path (basename without directory separators).
 * Normalizes mixed separators to `/` before scanning.
 */
function basename(path: string): string {
  const normalized = path.replace(/[\\/]+$/, '').replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;
}

/**
 * Builds a server-side target path for a file or folder row in the details panel.
 *
 * Handles the case where `contentPath` is the torrent root directory (normal multi-file
 * torrent) as well as cases where `contentPath` is itself a nested subfolder of the
 * torrent root — in the latter case, `row.path` already starts with the root segment
 * represented by `contentPath`'s basename and needs to be stripped before joining to
 * avoid duplication.
 *
 * - Single-file torrent: returns `contentPath` as-is (points to the file itself)
 * - Multi-file torrent: strips optional leading root segment from `row.path`, then joins
 *   with `contentPath`
 *
 * @param contentPath  The torrent's server-side content path (file for single-file, directory for multi-file)
 * @param rowPath     The tree row's relative path within the torrent
 * @param isSingleFile True if the torrent has only one file
 */
export function buildServerTargetPath(
  contentPath: string,
  rowPath: string,
  isSingleFile: boolean,
): string {
  // Normalize: strip trailing separators of either kind, then统一到 forward-slash
  const normalized = contentPath.replace(/[\\/]+$/, '').replace(/\\/g, '/');

  if (isSingleFile) {
    // contentPath already points to the file itself
    return normalized;
  }

  // contentPath is the torrent root directory; rowPath is relative to it.
  // Detect and strip any leading root segment that may already be present
  // in rowPath (happens when contentPath is itself a nested folder within
  // the torrent hierarchy).
  const rootName = basename(normalized);
  let relativeRowPath = rowPath;

  if (rowPath === rootName) {
    // rowPath is exactly the torrent root segment — no sub-path to append
    return normalized;
  }
  if (relativeRowPath.startsWith(rootName + '/')) {
    relativeRowPath = relativeRowPath.substring(rootName.length + 1);
  }

  return normalized + '/' + relativeRowPath;
}