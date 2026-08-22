# Localization Native Smoke Signoff

This checklist is the final hands-on acceptance gate for the English/Romanian
localization release. Run it against a worktree or packaged binary containing the
localization changes. Renderer Playwright tests do not count as native signoff.

Record the tester, date, commit, operating-system version, CPU architecture, and
binary type (`desktop:dev` or packaged release) for every platform. Attach screenshots
or a short screen recording where release process permits it.

## Signoff status

| Platform | Status | Tester/date/commit | Evidence |
| --- | --- | --- | --- |
| macOS | Pending interaction signoff | Native arm64 development build launched successfully on macOS 26.6 on 2026-08-21; Accessibility and Screen Recording inspection were unavailable | Runtime log showed localization bootstrap and renderer startup |
| Windows | Pending platform access | — | — |
| Linux | Pending platform access | — | — |

Use only `Pass` or `Fail` after completing every applicable item. A successful build
without interacting with menus, tray items, and windows is not a pass.

## Test preparation

1. Stop every installed or development Taurent instance so single-instance handling
   cannot redirect the test to a stale binary.
2. Start the target build:
   - Worktree: `pnpm desktop:dev`
   - Packaged release: launch the platform artifact normally.
3. Use a disposable Taurent profile when possible. Never delete or overwrite a user's
   active profile for this test.
4. Keep a saved qBittorrent server available for connected-state checks, but also test
   the first-run/login and disconnected states.
5. For a clean preference test, remove only the `taurent_language_preference` browser
   storage entry from the disposable profile. Do not alter qBittorrent's remote
   `Preferences.locale` value.

## All-platform language behavior

- [ ] With preference set to **System default**, an English system locale resolves to
      English and a Romanian regional locale such as `ro-RO` resolves to Romanian.
- [ ] An unsupported system locale and an invalid stored preference fall back to English.
- [ ] A clean Romanian launch paints Romanian on the first visible frame; English is not
      briefly visible.
- [ ] Selecting **English**, **Română**, and **System default** changes visible copy
      immediately without restarting or losing current route, selection, filters, or
      pending form values.
- [ ] The chosen override survives a complete quit and cold restart.
- [ ] Open auxiliary windows update their rendered text and native title after switching.
- [ ] Newly opened auxiliary windows use the current language immediately.
- [ ] Login, disconnected, and connected states all synchronize native labels.
- [ ] Torrent names, categories, tags, trackers, paths, URLs, server names, filenames,
      search results, RSS content, and other source data remain byte-for-byte unchanged.
- [ ] Numbers, dates, percentages, byte sizes, speeds, ratios, durations, and torrent
      states use the active locale while underlying values remain unchanged.

## macOS native menu

Switch to Romanian and inspect every submenu and item:

- [ ] App menu: About, Settings, Hide Taurent, Hide Others, Show All, and Quit Taurent.
- [ ] Edit menu: Undo, Redo, Cut, Copy, Paste, and Select All.
- [ ] File menu: Add Torrent.
- [ ] Torrent menu: Pause, Resume, Delete, Recheck, Reannounce, Force Start,
      Set Category, Set Tags, Queue Up/Down, and Move to Top/Bottom.
- [ ] View menu: sidebar, details-panel, and in-window-menubar toggles.
- [ ] Tools menu: Search, RSS, Statistics, and Settings.
- [ ] Help menu: About Taurent.
- [ ] Existing accelerators still work and are unchanged after both language switches.
- [ ] Torrent actions preserve their enabled/disabled state across language switches.
- [ ] View actions preserve their checked state across language switches.
- [ ] The Edit commands still act as native predefined menu items.
- [ ] Switching English → Romanian → English repeatedly does not duplicate menus or items.

## Tray and Rust-created windows

Run on macOS, Windows, and Linux:

- [ ] While the main window is visible, the tray action says the localized form of **Hide**.
- [ ] After hiding, it changes in place to the localized form of **Show**.
- [ ] Repeating Show/Hide does not rebuild, duplicate, close, or disable other tray items.
- [ ] Add Torrent, Alternative Speed Limits, Global Speed Limits, and Quit are translated.
- [ ] Alternative Speed Limits preserves its checked state while switching language.
- [ ] Tray Add Torrent opens an auxiliary window whose native title is localized.
- [ ] Tray Global Speed Limits opens an auxiliary window whose native title is localized.
- [ ] Those titles use the latest language even when the main renderer is hidden or absent.
- [ ] The tray remains functional during and after runtime language switching.

## Failure and fallback checks

- [ ] Temporarily force the Romanian catalog load to fail in a disposable development run.
      The app remains usable in English, sets `lang="en"`, and does not persist a false
      resolved locale.
- [ ] Known network/authentication failures show localized summaries and do not expose raw
      backend English as primary UI copy.
- [ ] Unsupported Search/RSS capabilities and updater failures are localized.
- [ ] Restoring the catalog and restarting returns to the stored preference normally.

## Closing the gate

After all three platform rows are `Pass`, update
`docs/localization-completion-plan.md`: mark Phase 8 **Complete**, add the three signoff
records to its completion evidence, and run `pnpm i18n:audit:ci`, `pnpm lint`, and
`git diff --check` once more. Only then is the localization goal complete.
