# packages/web-ui/src/components/

## Responsibility

Domain-grouped reusable React UI components for qBittorrent applications. Higher-level components are assembled from primitive controls and shared layout helpers.

## Component Taxonomy

### primitives
Base controls (all density-aware via `controlSizing`): `Button`, `Card`, `Checkbox`, `ContextMenu`, `Dropdown`, `DropdownMenu`, `FormField`, `FormSectionTitle`, `IconButton`, `Input`, `NumberInput`, `Pill`, `ProgressBar`, `SchemeToggle`, `SearchBar`, `Select`, `TabBar`, `ToggleSwitch`.

### layout
Workspace framing and navigation: `WorkspaceFrame`, `ScreenHeader`, `CommandBar`, `CommandBarGroup`, `ContextRailSection`, `InspectorSection`.

### dialogs
Modal workflows: `Dialog`, `ConfirmDialog`, `InputDialog`, `NumberInputModal`, `CategorySelectionDialog`, `TagSelectionDialog`, `FilePriorityDialog`, `DeleteTorrentDialog`, `PluginInstallDialog`, `DialogActions`.

### management
Lists and admin UI: `Composer`, `FilterListItem`, `FilterStatusList`, `FilterTagSection`, `FilterCategorySection`, `FilterTrackerSection`, `ManageCategories`, `ManageTags`.

### server-setup
Connection/onboarding: `ServerConnectionFields`, `LoginForm`, `AddServerForm`, `AddTorrentScreenBody`, `AuthLoadingScreen`, `StepIndicator`, `TestConnectionFeedback`.

### settings
Preference panels: `SettingsSection`, `SettingsRow`, `SettingsCard`, `ThemeSettingsPanel`, `TransferSettingsPanel`, `QueueSettingsPanel`, `RemoteSettingsPanel`, `ServerOverviewSettingsPanel`.

### shared
Cross-domain presentation: `StateCard`, `StateSurface`, `StatusPanel`, `RemoteSectionContainer`, `SettingToggle`, `InfoRow`, `SkeletonBlock`, `Spinner`, `RetryButton`, `SurfaceList`, `SurfaceListItem`, `MetadataList`, `MetadataRow`, `MetricCard`, `MutationErrorBanner`, `Toaster`/`toast`.

### torrents
Torrent detail/action: `TorrentDetailHeader`, `TorrentActions` (`ActionButton`, `ActionChip`, `TorrentActionsBar`), `TorrentDetailsSections`.

### Top-level standalone
`ServerCard`, `CredentialHealthIndicator`, `CredentialWarningBanner`, `SidebarFilterItem`, `Tooltip`.

## Design Patterns

- **Control density**: All primitives read `useControlDensity()` from `controlSizing` to select appropriate sizing classes. Mobile targets ~44px touch areas; desktop keeps compact sizing.
- **Primitive-first composition**: Domain components depend on primitive controls instead of duplicating inputs, toggles, cards, or buttons.
- **Platform variants**: Selected components support `variant: 'desktop' | 'mobile'` when platform layout diverges. Desktop components live in `*.web.tsx` files.
- **Controlled UI**: Settings and setup flows keep state in parents and expose explicit callbacks.
- **Leaf barrels**: Each component family exports through its own `index.ts` and co-located `types.ts`.
- **React.memo**: Components use `React.memo` for render optimization.

## Integration

- Consumed by screen bodies in `src/screens/` and by app shells.
- `src/index.ts` re-exports the public surface by domain, then exposes screen bodies as top-level entrypoints.
- Shared packages (`@taurent/shared`, `@taurent/web-core`) provide data types, formatters, and theme tokens; this package owns presentation composition only.
