# Localization

The phased execution plan for completing every user-facing surface is
[`localization-completion-plan.md`](./localization-completion-plan.md).

Taurent owns its English and Romanian catalogs under the repository's MIT
license. qBittorrent translations are terminology references only: do not copy,
convert, generate, or vendor Qt `.ts` catalogs into Taurent.

The terminology review for the first catalog consulted qBittorrent 5.2.2,
tag `release-5.2.2`, commit `89aad1a`, including its WebUI translation tree.

## Glossary

| Product concept | English | Romanian |
| --- | --- | --- |
| automatic torrent management | Automatic torrent management | Gestionare automată a torrentelor |
| reannounce | Reannounce | Reanunță |
| recheck | Recheck | Reverifică |
| share ratio | Share ratio | Raport de partajare |
| peers | Peers | Parteneri |
| seeds | Seeds | Surse |
| trackers | Trackers | Trackere |
| stalled | Stalled | Blocat |
| forced download | Forced download | Descărcare forțată |
| forced upload | Forced upload | Încărcare forțată |

User-authored values such as torrent names, categories, tags, trackers, paths,
and server names are never translated.

## Catalog rules

- English is canonical and eagerly bundled; other locales must match its keys.
- Preserve named interpolation placeholders exactly across locales.
- Add every plural form required by the target locale.
- Use semantic keys in module-level configuration; translate only while rendering.
- Keep qBittorrent's remote `Preferences.locale` independent from Taurent's UI language.

Catalogs are split by locale and namespace under `packages/shared/src/i18n/catalogs/`.
The locale assembly files (`en.ts` and `ro.ts`) are the public resource boundary;
English remains eager and the Romanian assembly plus all of its namespace modules
must remain in the lazy `ro` production chunk.

The typed namespace set is `common`, `auth`, `torrents`, `settings`, `errors`,
`dialogs`, `management`, `search`, `rss`, `statistics`, `desktop`, and `mobile`.
Add English and Romanian namespace keys together. Empty namespace modules are
intentional migration targets and must stay key-complete between locales.

Use `createLocalizedFormatters(locale, t)` for locale-aware numbers, counts,
percentages, dates, date-times, byte sizes, speeds, compact durations, ETA,
ratios, booleans, priorities, and torrent states. Do not change domain values or
unit calculations while migrating a display surface.

`createPseudoCatalog(englishCatalogs)` is available for development and tests.
Pseudo-localization expands/accentuates copy while preserving interpolation
tokens and embedded markup; it is not a shipped `SupportedLocale`.

## Audit workflow

- Run `pnpm i18n:audit` to see remaining user-facing literal candidates grouped by workspace and file.
- Run `pnpm i18n:audit:ci` to reject every unsuppressed production literal; the checked-in
  completion baseline is zero.
- Run `pnpm i18n:audit:baseline` only when intentionally updating the checked-in audit snapshot.
  A nonzero production baseline is a localization regression and must not be committed.
- Use `i18n-audit-ignore: <reason>` only beside a context-specific literal that must remain verbatim.
  The rationale must explain why the value is not translatable.
- Product/protocol names and units shared across all contexts live in the exact-literal allowlist.
- Keep English and Romanian catalogs in lockstep and run the audit, catalog tests, and affected
  renderer tests with every user-facing copy change.
