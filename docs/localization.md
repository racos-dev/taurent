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
