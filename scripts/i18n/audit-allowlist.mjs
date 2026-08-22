/**
 * Exact literals that are intentionally identical in every locale.
 *
 * Keep this list limited to product/protocol names, platform names, units, and
 * symbols. Context-specific exceptions belong beside the source as an
 * `i18n-audit-ignore: <reason>` comment.
 */
export const exactLiteralAllowlist = new Map([
  ['Taurent', 'product name'],
  ['qBittorrent', 'upstream product name'],
  ['BitTorrent', 'protocol name'],
  ['HTTP', 'protocol name'],
  ['HTTPS', 'protocol name'],
  ['RSS', 'standard name'],
  ['API', 'technical initialism'],
  ['CORS', 'technical initialism'],
  ['WebUI', 'qBittorrent feature name'],
  ['Android', 'platform name'],
  ['iOS', 'platform name'],
  ['Linux', 'platform name'],
  ['macOS', 'platform name'],
  ['Windows', 'platform name'],
  ['B', 'byte unit'],
  ['KB', 'byte unit'],
  ['MB', 'byte unit'],
  ['GB', 'byte unit'],
  ['TB', 'byte unit'],
  ['KiB', 'byte unit'],
  ['MiB', 'byte unit'],
  ['GiB', 'byte unit'],
  ['{{…}}/s', 'rate unit suffix'],
]);
