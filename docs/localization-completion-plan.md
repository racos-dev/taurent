# Localization Completion Plan

Status: Active  
Created: 2026-08-21  
Scope: Complete English and Romanian localization for every Taurent desktop,
mobile, shared-renderer, auxiliary-window, and native user-facing surface.

This is the execution checklist for finishing localization. Keep it updated as
work lands: only one phase should be marked **In progress**, completed phases
must satisfy their exit gates, and newly discovered user-facing text must be
added to the current or next applicable phase.

## Current baseline

The localization foundation is complete:

- `i18next` and `react-i18next` run from `@taurent/shared` without Tauri imports.
- English is eager, Romanian is lazy, and unsupported locales fall back to English.
- `system | en | ro` is persisted locally and reacts to system language changes.
- Desktop and mobile initialize localization before importing/rendering `App`.
- Locale changes update `lang`, `dir`, formatting, React text, and Rust workspace collation.
- Desktop windows synchronize locale changes and send authoritative native labels to Rust.
- Native menu/tray handles are updated in place and Rust caches localized window titles.
- Catalog integrity, runtime switching, bridge serialization, Rust caching, and Romanian
  renderer journeys have initial automated coverage.

A heuristic inventory on 2026-08-21 found:

- 476 candidate user-facing literals in production JSX.
- 347 candidate display strings in production TypeScript configuration/models.
- The largest concentrations are remote settings, torrent details, RSS, add-torrent,
  mobile settings, statistics, server management, search, and desktop command models.

These counts are an inventory baseline, not an assertion that every match must be
translated. Protocol values, units, shortcuts, identifiers, user data, and internal
diagnostics require classification.

## Definition of done

Localization is complete only when all of the following are true:

1. The localization audit reports zero unapproved user-visible string literals.
2. Every production route, dialog, auxiliary window, native menu, tray menu,
   notification, placeholder, tooltip, and accessibility label has a semantic key.
3. English and Romanian catalogs have identical non-empty keys, interpolation
   placeholders, and required plural forms.
4. Runtime switching updates every open desktop window without remounting the
   application provider tree or losing application state.
5. Mobile and desktop show no English fallback on Romanian primary or secondary routes.
6. Known failures have translated user-facing summaries; raw backend text is retained
   only as optional diagnostic detail.
7. User-authored and server-authored domain data remains unchanged.
8. Locale-aware sorting and formatting use the active Taurent locale without changing
   stored values, byte calculations, API values, or qBittorrent preferences.
9. All automated validation in the final phase passes.
10. The native manual smoke checklist is signed off on macOS, Windows, and Linux.

## Non-translatable and allowed literal policy

The following may remain literal when they are not used as natural-language UI copy:

- Product/protocol names: `Taurent`, `qBittorrent`, `BitTorrent`, `HTTP`, `HTTPS`,
  `RSS`, `API`, `CORS`, `WebUI`, and platform names.
- Units and symbols: `B`, `KB`, `MB`, `GB`, `TB`, `KiB`, `%`, `∞`, and rate suffixes.
- Keyboard shortcuts, menu IDs, route names, event names, bridge commands, storage keys,
  preference keys, and test selectors.
- User/server data: torrent names, categories, tags, trackers, paths, URLs, usernames,
  server names, filenames, plugin names, and backend-provided diagnostic text.
- Internal logs, developer assertions, and errors that can never be rendered.
- English native construction labels used only before the renderer's first native-label sync.

Every audit suppression must be narrow and explain why the literal is not user-facing.
Do not add directory-wide exclusions for production UI.

## Repository constraints

- Preserve layering: apps → web-core/web-ui → bridge → Rust.
- `packages/shared`, `packages/web-core`, and `packages/web-ui` must not import Tauri APIs.
- Static configuration stores keys, never translated strings captured at module evaluation.
- Headless controllers return semantic codes or keys, not rendered text.
- Translate in React hooks/components or explicit localized model factories.
- Keep one QueryClient per app and preserve logging-before-App bootstrap order.
- Do not couple Taurent's language preference to qBittorrent `Preferences.locale`.
- qBittorrent translations remain terminology references only; never copy or generate
  Taurent catalogs from GPL Qt `.ts` files.
- Do not rebuild native menus or tray menus to change language.

## Key and catalog conventions

- English remains canonical.
- Prefer semantic keys describing intent, for example
  `torrents.actions.forceStart`, not keys derived from English sentences.
- Reuse genuinely identical concepts through `common`; do not reuse a key merely because
  two English phrases currently match.
- Keep interpolation named: `{{count}}`, `{{name}}`, `{{path}}`.
- Never concatenate translated fragments when word order may differ. Translate the complete
  sentence or use component interpolation.
- Keep user data as interpolation values and never pass it through translation lookup.
- Add translator comments/context for ambiguous terms such as ratio, availability,
  queue priority, share limits, and alternative speed limits.
- Prefer feature namespaces. The target namespace set is:
  `common`, `auth`, `torrents`, `settings`, `errors`, `dialogs`, `management`,
  `search`, `rss`, `statistics`, `desktop`, and `mobile`.
- Split catalogs by namespace before they become difficult to review. The loader may still
  assemble one locale resource object and preserve English-eager/Romanian-lazy behavior.

## Execution protocol

For every phase:

1. Mark the phase **In progress** in the status table.
2. Refresh the literal audit for the phase's directories.
3. Add English keys and Romanian translations together.
4. Migrate production code without translating domain data or changing behavior.
5. Add or update focused tests.
6. Run the phase exit gate.
7. Record remaining audit counts and any intentional suppressions.
8. Mark the phase **Complete** only after its gate passes.

Do not defer Romanian until the end. Keeping catalogs in lockstep makes completeness tests
useful throughout the migration.

## Phase status

| Phase | Scope | Status | Exit evidence |
| --- | --- | --- | --- |
| Foundation | Runtime, bootstraps, selector, formatting, desktop native sync | Complete | Existing unit, E2E, build, and Rust validation |
| 0 | Inventory and enforcement | In progress | Audit command, baseline report, CI policy |
| 1 | Catalog structure and typed authoring | Pending | Namespace split, strict keys, catalog tests |
| 2 | Static registries and model factories | Pending | No captured display text in shared/static models |
| 3 | Common, authentication, and server lifecycle | Pending | All onboarding/server flows complete in Romanian |
| 4 | Torrent workspace and torrent-detail journeys | Pending | Desktop/mobile torrent routes complete in Romanian |
| 5 | Application and remote settings | Pending | All local/remote settings complete in Romanian |
| 6 | Management, dialogs, statistics, search, and RSS | Pending | All secondary routes complete in Romanian |
| 7 | Platform shells, errors, notifications, and accessibility | Pending | App-specific audit reaches zero |
| 8 | Full audit, regression suite, builds, and native release smoke | Pending | Definition of done satisfied |

## Phase 0 — Inventory and enforcement

### Goal

Turn localization completeness into a deterministic, repeatable repository check.

### Deliverables

- Add `scripts/i18n/audit.mjs` using the TypeScript compiler AST rather than regex alone.
- Add root commands:
  - `pnpm i18n:audit` for a human-readable report.
  - `pnpm i18n:audit:ci` for a machine-enforced result.
- Detect at minimum:
  - JSX text nodes containing natural-language text.
  - String-valued display attributes such as `aria-label`, `title`, `placeholder`,
    `label`, `description`, `helperText`, and empty/loading/error text props.
  - Display-oriented object fields such as `label`, `title`, `description`, `message`,
    `tooltip`, `confirmText`, and `cancelText`.
  - Toast/notification calls, browser confirmations, and visible error summaries.
  - Desktop `setTitle`, window configuration titles, menu labels, and tray labels.
- Classify findings by workspace and feature, and output JSON plus a readable summary.
- Add a narrow suppression mechanism requiring a rationale.
- Check in a baseline report so reductions are visible. CI initially rejects regressions;
  after Phase 7 it rejects every unsuppressed finding.
- Document the audit policy in `docs/localization.md`.

### Likely files

- `scripts/i18n/audit.mjs`
- `scripts/i18n/audit-allowlist.*`
- `package.json`
- script tests under `scripts/__tests__` or the existing script-test location
- `docs/localization.md`

### Exit gate

- Audit tests cover true positives, approved literals, domain data, and internal diagnostics.
- `pnpm i18n:audit` produces stable categorized output.
- `pnpm test:scripts`, `pnpm lint`, and `pnpm typecheck` pass.
- Baseline counts and suppressions are recorded in this document.

## Phase 1 — Catalog structure and typed authoring

### Goal

Make a large catalog reviewable, strictly typed, and safe to extend across phases.

### Deliverables

- Split English and Romanian resources into namespace modules.
- Add `dialogs`, `management`, `search`, `rss`, and `statistics` namespaces.
- Preserve a single typed assembly point per locale and Romanian lazy loading.
- Tighten translation typing so namespace and key mistakes fail TypeScript where practical.
- Add helpers for localized model factories that need multiple namespaces.
- Extend localized formatters for all rendered value families currently implemented ad hoc:
  numbers, percentages, dates, date-times, durations, speeds, byte sizes, ratios,
  booleans, priorities, and torrent states.
- Add an optional development/test pseudo-localization transform to expose missed literals,
  truncation, and unsafe concatenation without shipping another supported locale.
- Expand glossary/context notes for remote settings and torrent concepts.

### Likely files

- `packages/shared/src/i18n/**`
- `packages/shared/src/utils/formatters.ts`
- `docs/localization.md`

### Tests

- Namespace/key typing fixtures.
- Catalog completeness and empty-value checks.
- Placeholder parity and Romanian plural-category checks.
- Lazy catalog failure and English fallback.
- Formatter output for `en` and `ro` without changing existing unit semantics.
- Pseudo-localization preserves interpolation tokens.

### Exit gate

- Shared localization tests pass.
- Both frontend builds still emit Romanian separately from the eager English resources.
- No Tauri imports enter shared/web-core/web-ui.

## Phase 2 — Static registries and localized model factories

### Goal

Remove module-evaluation English from configuration and action models before migrating
the consuming screens.

### Deliverables

- Convert remote-settings definitions from `title`, `label`, `description`, editor text,
  enabled/disabled labels, and select labels to typed translation keys.
- Convert torrent filter and sort options to semantic keys.
- Convert desktop column definitions to key-only labels.
- Convert theme/palette display metadata to keys while keeping theme IDs stable.
- Convert torrent action descriptors and desktop transfer commands to keys or a localized
  factory/hook.
- Convert desktop auxiliary/dialog window definitions to title keys. Resolve them at open
  time and continue updating already-open titles on locale changes.
- Replace remaining captured English in web-core screen/controller models with semantic
  values or keys.
- Pass an explicit active locale/collator to any renderer-side string sort that is still
  used; keep classification and stored values pure.

### Primary targets

- `packages/shared/src/settings/remoteSettingsSections.ts`
- `packages/shared/src/settings/remoteSettings.ts`
- `packages/shared/src/utils/torrentFilter.ts`
- `packages/shared/src/utils/sortTorrents.ts`
- `packages/shared/src/theme/registry.ts`
- `packages/web-ui/src/components/torrents/TorrentActions/model.ts`
- `apps/desktop/src/stores/columnRegistry.ts`
- `apps/desktop/src/hooks/torrents/useTransferCommandList.ts`
- `apps/desktop/src/windows/**`
- `packages/web-core/src/screens/**`

### Tests

- Static registries contain no natural-language display strings.
- Localized factories recompute after switching language.
- IDs, preference keys, sort fields, commands, and values remain unchanged.
- Auxiliary windows open with the active translated title.

### Exit gate

- The TypeScript configuration/model portion of the audit reaches zero, except documented
  protocol/unit/internal literals.
- Shared, web-core, bridge, desktop, and mobile typechecks and focused tests pass.

## Phase 3 — Common, authentication, and server lifecycle

### Goal

Complete every surface needed to launch Taurent, add/manage a server, authenticate,
recover from connection problems, and navigate shared primitives.

### Deliverables

- Finish login, add-server, test-connection, saved-server, switch-server, credential
  warning, delete/edit server, and connection-recovery copy.
- Translate common controls: add, cancel, save, retry, close, back, search, clear,
  confirmation, selection, pagination, and empty/loading/offline states.
- Translate reusable primitive accessibility labels and instructions.
- Ensure dynamic server names, URLs, usernames, and backend details remain unchanged.
- Replace sentence-fragment assembly with full-message keys and interpolation.

### Primary targets

- `packages/web-ui/src/components/server-setup/**`
- `packages/web-ui/src/components/settings/ServerOverviewSettingsPanel/**`
- `packages/web-ui/src/components/ServerCard/**`
- `packages/web-ui/src/components/CredentialWarningBanner/**`
- `packages/web-ui/src/components/primitives/**`
- `packages/web-ui/src/components/shared/**`
- desktop/mobile login, add-server, server-list, and auth-boundary screens

### Exit gate

- Fresh install → add server → connect → failure/retry → manage/switch/delete server is
  complete in Romanian on desktop and mobile.
- Focused unit tests and English/Romanian renderer tests pass.
- Audit is zero for Phase 3 directories.

## Phase 4 — Torrent workspace and detail journeys

### Goal

Complete the main product experience on both platforms.

### Deliverables

- Translate torrent list columns, sort controls, filters, toolbar actions, context menus,
  selection summaries, loading/empty/error states, drag-and-drop copy, and status surfaces.
- Complete add-torrent link/file modes, validation, destination/options, success/failure,
  and accessibility copy.
- Complete torrent details: header, overview, files, peers, trackers, HTTP sources,
  priorities, metadata, and empty/error states.
- Complete pause/resume, force start, recheck, reannounce, priority, location, rename,
  category/tag, delete, and speed/share-limit flows.
- Use localized formatters consistently while preserving torrent/user data.

### Primary targets

- `packages/web-ui/src/screens/HomeScreen/**`
- `packages/web-ui/src/components/server-setup/AddTorrentScreenBody/**`
- `packages/web-ui/src/screens/TorrentDetailScreen/**`
- `packages/web-ui/src/components/torrents/**`
- desktop toolbar/table/detail/sidebar/status/context-menu components
- mobile home, filter, add-torrent, and torrent-detail screens
- torrent-related desktop dialog screens and window definitions

### Exit gate

- The complete desktop and mobile torrent core journey passes in Romanian.
- Runtime switching preserves selection, filters, detail state, and pending form values.
- No user/domain values are translated.
- Audit is zero for Phase 4 directories.

## Phase 5 — Application and remote settings

### Goal

Localize every app-owned and qBittorrent remote settings surface.

### Deliverables

- Translate desktop behavior, appearance, language, servers, path mappings, about,
  updater, and close-with-unsaved-changes flows.
- Translate mobile appearance, language, server management, and setting editors.
- Translate every remote setting section, group, field, select option, description,
  editor title, unit note, enabled/disabled label, validation, and save state.
- Keep qBittorrent preference keys and values unchanged, especially remote locale.
- Verify conditional fields and mobile editor models resolve translations at render time.

### Primary targets

- `packages/shared/src/settings/**`
- `packages/web-ui/src/components/settings/**`
- `packages/web-ui/src/components/shared/RemoteSectionContainer/**`
- `apps/desktop/src/components/Settings/**`
- `apps/desktop/src/screens/SettingsScreen.tsx`
- `apps/mobile/src/screens/MobileSettingsScreenBody.tsx`

### Exit gate

- Every app and remote settings section is readable without English fallback in Romanian.
- Save/reset/error flows pass without changing serialized preference values.
- Desktop and mobile settings E2E cover representative boolean, numeric, select, text,
  conditional, and unlimited-value controls in Romanian.
- Audit is zero for Phase 5 directories.

## Phase 6 — Management, dialogs, statistics, search, and RSS

### Goal

Finish all secondary and management surfaces explicitly left on English fallback in the pilot.

### Deliverables

- Translate filters and category/tag/tracker management lists and dialogs.
- Translate all generic confirmation, text, number, priority, selection, and plugin dialogs.
- Translate statistics cards, labels, empty/error states, and window title.
- Translate search tabs/forms/results/plugin installation flows and capability states.
- Translate RSS feeds, rules, articles, validation, empty/error states, and management actions.
- Preserve feed titles, article text, search results, plugin names, URLs, categories, tags,
  and trackers as source data.

### Primary targets

- `packages/web-ui/src/components/management/**`
- `packages/web-ui/src/components/dialogs/**`
- `packages/web-ui/src/screens/FiltersScreen/**`
- `packages/web-ui/src/screens/StatisticsScreen/**`
- `packages/web-ui/src/screens/SearchScreen/**`
- `packages/web-ui/src/screens/RSSScreen/**`
- corresponding desktop/mobile route screens and window definitions

### Exit gate

- Every secondary route and dialog opens fully localized in Romanian.
- Search/RSS unsupported and error states are translated.
- Audit is zero for Phase 6 directories.

## Phase 7 — Platform shells, errors, notifications, and accessibility

### Goal

Close cross-cutting gaps that feature-by-feature migration can miss.

### Deliverables

- Translate desktop menu bar, sidebar headings, toolbar tooltips, status bar, context menus,
  update UI, root error boundary, settings-close overlay, and native action feedback.
- Translate mobile headers, bottom navigation, floating actions, platform prompts,
  drill-in screen titles, and native file-picker surrounding copy.
- Inventory every toast, notification, visible thrown error, validation message, and retry state.
- Establish semantic error categories at the UI boundary. Translate the summary and retain
  raw backend text only in an optional detail field where useful.
- Inventory accessibility names, descriptions, live regions, keyboard instructions,
  image/icon labels, and screen-reader-only text.
- Verify all open desktop windows update document locale, rendered text, and title after
  a language broadcast without event echo loops.
- Verify native labels remain synchronized on login, disconnected, and auxiliary windows.

### Primary targets

- remaining `apps/desktop/src/**`
- remaining `apps/mobile/src/**`
- `packages/web-core/src/hooks/useOperationNotifications.ts`
- shared validation/error utilities used by UI
- desktop bridge/native synchronization and mocks

### Exit gate

- Production audit reaches zero unsuppressed findings across apps and packages.
- Suppressions have individual rationales and pass review.
- Automated accessibility checks and keyboard-focused smoke tests pass in both locales.
- Cross-window and native-label synchronization tests pass.

## Phase 8 — Full validation and release smoke

### Goal

Prove completeness, prevent regressions, and close the localization goal.

### Automated validation

- `pnpm i18n:audit:ci`
- `pnpm test:scripts`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm mobile:test`
- `pnpm desktop:test:browser`
- `pnpm desktop:renderer:e2e`
- `pnpm mobile:renderer:e2e`
- `pnpm desktop:build`
- `pnpm mobile:build`
- `cargo fmt --all --check`
- `cargo check --workspace --locked`
- `cargo test --workspace --locked`
- `cargo clippy --workspace --all-targets --locked`

### E2E route matrix

Exercise at minimum in both English and Romanian:

- First-run add server, login, connection failure/retry, and server management.
- Torrent workspace, filters/sorts, add torrent, details, and every common action/dialog.
- Local and remote settings, including runtime language switching.
- Category/tag/tracker management.
- Statistics, search, RSS, unsupported capability states, and error states.
- Desktop auxiliary windows opened before and after a language change.
- State preservation while switching language.

English fixtures remain explicitly pinned to English. Romanian tests must assert both visible
copy and `document.documentElement.lang`; desktop tests also assert title and native-label calls.

### Manual native smoke

macOS:

- App/submenu labels, regular/check items, predefined Edit actions, accelerators, enabled and
  checked state, tray Show/Hide forms, all tray actions, runtime switching, and open-window titles.

Windows and Linux:

- Tray labels, Show/Hide transitions, checked state, Rust-created window titles, login/disconnected
  synchronization, and runtime switching.

All platforms:

- System-language selection, invalid/unsupported system locale fallback, persisted override,
  cold Romanian launch without an English flash, and catalog-load failure fallback.

### Final exit gate

- Every item in the definition of done is satisfied.
- Audit baseline is removed or set to zero; CI rejects any new unsuppressed literal.
- `docs/localization.md` describes the final contributor workflow.
- This status table marks every phase Complete and records final validation results.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Mechanical key migration changes behavior | Separate semantic IDs/values from labels and test serialized/bridge payloads |
| Catalog becomes too large to review | Split by namespace and migrate one feature family per phase |
| Static models retain old language | Store keys or use localized factories; test runtime switching |
| Raw backend text is mistaken for catalog text | Translate summaries only; preserve source detail separately |
| Romanian text causes clipping | Use pseudo-localization plus mobile/desktop visual checks |
| Dynamic desktop windows show stale titles | Resolve title at open time and update on locale events |
| Native menu rebuild disturbs state | Keep stable handles and use `set_text` only |
| Audit produces noisy false positives | AST classification and narrow documented suppressions |
| Translation terminology drifts | Maintain the glossary and review qBittorrent only as a terminology reference |
| Secondary routes regress | Add route-matrix E2E before declaring their phase complete |

## Documentation decision

No framework documentation check is required before starting these phases. The i18next,
React integration, and Tauri synchronization architecture is already implemented and validated.
Use current official documentation only if a later phase changes those APIs or introduces new
library behavior.
