# packages/shared/src/settings/

## Responsibility

Settings domain layer for remote qBittorrent preferences and mobile-desktop parity mapping. Contains:

- Full metadata registry for qBittorrent remote preferences (150+ settings with labels, validation, help text, min/max, select options).
- Parity mapping between mobile and desktop settings sections.
- Remote settings section registry with per-platform field declarations (desktop vs mobile field lists).
- Utility functions for setting classification (remote-only, desktop-local, mobile-only).
- Shared dirty-state helpers for staging comparison in settings panels.

## Key Files

- `remoteSettings.ts` — `REMOTE_SETTINGS_METADATA`: comprehensive record mapping every `Preferences` key to `RemoteSettingMetadata` (displayLabel, helpText, valueType, validation function, desktopSection, min/max, options, remoteOnly flag). Also exports:
  - `getRemoteSettingMetadata(key)` — lookup helper.
  - `validatePreferenceValue(key, value)` — type-safe validation.
  - `DESKTOP_LOCAL_SETTINGS` — settings only configurable on desktop.
  - `MOBILE_ONLY_SETTINGS` — settings only configurable on mobile.
  - `isDesktopLocalSetting(key)`, `isMobileOnlySetting(key)` — classification predicates.

- `remoteSettingsSections.ts` — `REMOTE_SETTINGS_SECTIONS` registry with 7 sections:
  - `behavior`, `downloads`, `connection`, `speed`, `bittorrent`, `webui`, `advanced`.
  - Each section declares `title`, `description`, `groups` (sub-sections), `desktopFields`, and `mobileFields`.
  - Field types: `BooleanField`, `NumberField`, `StringField`, `TextareaField`, `SelectField`.
  - Number fields support `mobileEditor` with `NumberEditorMeta` (title, unit, toDisplay/fromDisplay transforms for scaled values like ratio x100).
  - `visibleWhen` predicates for conditional field visibility based on other preference values.
  - Helper functions: `bool()`, `num()`, `str()`, `txt()`, `sel()` for concise field definitions.

- `parityMap.ts` — Mobile-to-desktop section mapping:
  - `MobileSection` (9 values: app, speed, queue, connection, download, seeding, privacy, webui, advanced).
  - `DesktopSection` (13 values: behavior, downloads, connection, speed, bittorrent, webui, advanced, general, transfers, network, seeding, privacy, categories, tags).
  - `MOBILE_TO_DESKTOP_SECTION_MAP` — maps each mobile section to its desktop equivalent or `UNSUPPORTED`.
  - `SECTION_UNSUPPORTED_REASON` — metadata about why a section is unsupported (`mobile-only`, `desktop-local`, etc.).
  - `hasRemoteParity(section)`, `getDesktopSection(section)` — utility functions.

- `remoteSettingsHelpers.ts` — Shared dirty-state helpers:
  - `getDefaultForField(field)` — returns the default value for a `RemoteSettingsField`.
  - `isSectionDirty(section, staged, initial)` — compares staged values against initial values for a section.
  - `getDirtyFieldKeys(section, staged, initial)` — returns keys with changes between staged and initial values.
  - Paired with the `RemoteSettingsField` discriminated union from `remoteSettingsSections.ts`.

- `__tests__/remoteSettingsHelpers.test.ts` — (269 lines) Test suite for `remoteSettingsHelpers`.

- `index.ts` — Barrel export for all settings utilities.

## Design

- **Metadata-driven**: All remote settings defined as constant objects with full metadata.
- **Per-platform field declarations**: Section registry explicitly lists which fields appear on each platform.
- **Conditional visibility**: `visibleWhen` predicates enable dynamic field visibility based on current preference values.
- **Parity tracking**: Maps mobile sections to desktop sections for feature parity analysis.
- **Setting classification**: Distinguishes remote-only, desktop-local, and mobile-only settings.
- **Dirty-state helpers**: `getDefaultForField`, `isSectionDirty`, and `getDirtyFieldKeys` support staged-value comparison for desktop settings panels.

## Integration

- Used by desktop and mobile settings screens (`RemoteSettingsPanel` component).
- `remoteSettings.ts` uses `Preferences` type from `../types/qbittorrent`.
- `parityMap.ts` uses `DesktopSection` type.
- `remoteSettingsSections.ts` powers the mobile NumberInputModal with `toDisplay`/`fromDisplay` transforms.
- `remoteSettingsHelpers.ts` is consumed by `RemoteSettingsPanel` for staging/dirty comparison.
- Powers the settings sync feature between mobile and desktop.
- Exported from `packages/shared/src/index.ts` indirectly through the settings barrel.
