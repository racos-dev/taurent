# packages/web-ui/

## Responsibility

Reusable UI component library and screen bodies for qBittorrent desktop and mobile applications. Provides React UI primitives, domain-grouped components, screen body components, and a theme provider that work across both platforms using Tailwind CSS theming.

## Source Structure

```
packages/web-ui/src/
├── index.ts                    # Public barrel (263 lines) — all component + screen exports
├── codemap.md                  # This file
├── controlSizing/              # Cross-cutting density system for desktop/mobile control sizing
│   ├── ControlDensityProvider.tsx  # React context provider + useControlDensity() hook
│   ├── controlSizeClasses.ts       # Static Tailwind class maps keyed by ControlDensity
│   ├── index.ts                    # Barrel re-export
│   └── codemap.md
├── theme/
│   ├── index.ts                # Theme barrel
│   ├── ThemeProvider.tsx        # React context provider for theme mode/config + accent support
│   └── codemap.md
├── screens/
│   ├── codemap.md
│   ├── HomeScreen/             # HomeScreenBody — torrent list presentation
│   │   ├── HomeScreenBody.tsx
│   │   ├── types.ts            # SortOption, FilterSummaryItem, HomeScreenProps
│   │   └── codemap.md
│   ├── SearchScreen/           # SearchScreenBody — search plugin + results
│   ├── RSSScreen/              # RSSScreenBody — RSS rules + items
│   ├── SettingsScreen/         # SettingsScreenBody — server preferences
│   ├── FiltersScreen/          # FiltersScreenBody — filter state management
│   ├── TorrentDetailScreen/    # TorrentDetailScreenBody — tabbed detail view
│   └── StatisticsScreen/       # StatisticsScreenBody — server transfer stats
├── components/
│   ├── codemap.md              # Component taxonomy and design patterns
│   ├── primitives/             # Base controls (all density-aware via controlSizing)
│   │   ├── Button/             # Button (variant: desktop|mobile, density-aware sizing)
│   │   ├── Card/               # Card (variant, padding, radius)
│   │   ├── Checkbox/           # Checkbox (density-aware touch target)
│   │   ├── ContextMenu/        # ContextMenu + ContextMenuPanel + submenu (forwardRef)
│   │   ├── Dropdown/           # DropdownPanel + useDropdownPanel hook
│   │   ├── DropdownMenu/       # DropdownMenu with menu items
│   │   ├── FormField/
│   │   ├── IconButton/         # Icon-only button (variant, tone, active, loading)
│   │   ├── Input/              # Input (variant: desktop|mobile, density-aware sizing)
│   │   ├── NumberInput/
│   │   ├── Pill/               # Inline tag/pill (tone prop)
│   │   ├── ProgressBar/        # ProgressBar (variant, size)
│   │   ├── SchemeToggle/       # Light/dark mode toggle
│   │   ├── SearchBar/          # Search input wrapper (auto-focus, clear-on-empty)
│   │   ├── Select/             # Select (density-aware trigger sizing)
│   │   ├── TabBar/             # Tab navigation (density-aware item sizing)
│   │   └── ToggleSwitch/       # Toggle (density-aware touch target)
│   ├── layout/                 # Layout primitives
│   │   ├── ScreenHeader/
│   │   ├── WorkspaceFrame/
│   │   ├── CommandBar/         # CommandBar + CommandBarGroup
│   │   ├── ContextRailSection/
│   │   └── InspectorSection/
│   ├── dialogs/                # Modal workflows
│   │   ├── Dialog/             # Base Dialog
│   │   ├── ConfirmDialog/      # Confirm/cancel dialog
│   │   ├── InputDialog/        # Text input dialog
│   │   ├── NumberInputModal/   # Numeric input dialog
│   │   ├── DeleteTorrentDialog/
│   │   ├── CategorySelectionDialog/
│   │   ├── TagSelectionDialog/
│   │   ├── FilePriorityDialog/
│   │   ├── PluginInstallDialog/
│   │   └── DialogActions/      # DialogActions + DialogAction types
│   ├── management/             # Admin-style list components
│   │   ├── ManageCategories/
│   │   ├── ManageTags/
│   │   ├── FilterListItem/
│   │   ├── FilterStatusList/
│   │   ├── FilterTagSection/
│   │   ├── FilterCategorySection/
│   │   ├── FilterTrackerSection/
│   │   └── Composer/
│   ├── server-setup/           # Onboarding/connection flows
│   │   ├── LoginForm/
│   │   ├── AddServerForm/
│   │   ├── AddTorrentScreenBody/
│   │   ├── ServerConnectionFields/
│   │   ├── AuthLoadingScreen/
│   │   ├── TestConnectionFeedback/
│   │   └── StepIndicator/
│   ├── settings/               # Preference panels
│   │   ├── SettingsSection/
│   │   ├── SettingsRow/
│   │   ├── SettingsCard/
│   │   ├── ThemeSettingsPanel/
│   │   ├── TransferSettingsPanel/
│   │   ├── QueueSettingsPanel/
│   │   ├── RemoteSettingsPanel/
│   │   └── ServerOverviewSettingsPanel/
│   ├── shared/                 # Cross-domain helpers
│   │   ├── StateCard/
│   │   ├── StateSurface/
│   │   ├── StatusPanel/
│   │   ├── RemoteSectionContainer/
│   │   ├── SettingToggle/
│   │   ├── InfoRow/
│   │   ├── SkeletonBlock/
│   │   ├── Spinner/
│   │   ├── RetryButton/
│   │   ├── SurfaceList/
│   │   ├── SurfaceListItem/
│   │   ├── MetadataList/
│   │   ├── MetadataRow/
│   │   ├── MetricCard/
│   │   ├── MutationErrorBanner/
│   │   ├── Toast/              # Sonner-based toast system
│   │   └── codemap.md
│   ├── torrents/               # Torrent-specific components
│   │   ├── TorrentDetailHeader/
│   │   ├── TorrentActions/     # ActionButton, ActionChip, TorrentActionsBar + model
│   │   └── TorrentDetailsSections/  # Overview, Trackers, Files, Peers, HttpSources
│   ├── ServerCard/
│   ├── CredentialHealthIndicator/
│   ├── CredentialWarningBanner/
│   ├── SidebarFilterItem/
│   └── Tooltip/
```

## Design Patterns

- **Domain grouping**: Components organized by purpose — `primitives`, `layout`, `dialogs`, `management`, `server-setup`, `settings`, `shared`, `torrents`.
- **Control density system**: `controlSizing/` provides a cross-cutting `ControlDensity` context (`'desktop' | 'mobile'`) and static Tailwind class maps for every covered primitive. Desktop is the default (compact sizing); mobile opts in via `<ControlDensityProvider value="mobile">` at the app shell. All covered primitives call `useControlDensity()` to select appropriate sizing classes.
- **Primitive-first composition**: Higher-level domains build on primitive controls (Button, Card, Input, IconButton, SearchBar, etc.) rather than reimplementing them.
- **Screen bodies as presentation layer**: `src/screens/` exports `*ScreenBody` components that consume props from web-core screen controllers. Controllers are headless; bodies handle layout and presentation.
- **Platform variants**: Selected primitives accept `variant: 'desktop' | 'mobile'` when platform layout diverges (Button, Card, Input, ProgressBar). Density-aware sizing supplements platform variants by adjusting touch targets, padding, and text sizes.
- **Public barrels**: Each leaf folder exposes `index.ts` and co-located `types.ts`. `src/index.ts` is the only package-level export surface.
- **Tailwind CSS**: Uses semantic tokens (`bg-surface`, `text-text-primary`, etc.) from `@taurent/shared/theme`. No literal color classes.
- **Controlled inputs**: All form components are fully controlled, accepting `value` + `onChange` props.
- **Action model separation**: `TorrentActions/model.ts` is self-contained presentation builders with no web-core imports; action orchestration lives in web-core to avoid dependency cycles.
- **Toast system**: Uses `sonner` library wrapped in `Toaster` and `toast` exports.
- **Accent theme support**: ThemeProvider supports custom accent colors for the Midnight palette via `AccentPreference` (hex string or null) and applies CSS custom property overrides via `deriveMidnightAccentTokens`.

## Screen Bodies

| Screen | Body Component | Description |
|--------|---------------|-------------|
| Home | `HomeScreenBody` | Torrent list with sort, filter summary, selection |
| Search | `SearchScreenBody` | Search plugin list + results display |
| RSS | `RSSScreenBody` | RSS rules + items management |
| Settings | `SettingsScreenBody` | Server preferences composition |
| Filters | `FiltersScreenBody` | Filter state UI with confirm dialog |
| Torrent Detail | `TorrentDetailScreenBody` | Tabbed view (overview, trackers, files, peers, httpSources) |
| Statistics | `StatisticsScreenBody` | Server transfer statistics |

## Integration

- **Imports from**: `@taurent/shared` (types, formatters, theme tokens, `cn`), `@taurent/web-core` (screen controller types).
- **Exports to**: `apps/desktop` and `apps/mobile` via direct imports from `@taurent/web-ui`.
- **Depends on**: `@taurent/shared`, `@taurent/web-core`, `sonner`.
- **Must NOT**: Import `@tauri-apps/*` directly; use `@taurent/bridge` for platform bindings.
- **Subpath exports**: `@taurent/web-ui` (root), `@taurent/web-ui/components/*`, `@taurent/web-ui/theme`.

## Key Constraints

- No `@tauri-apps/*` imports.
- No business logic in components; data fetching and mutations belong in web-core.
- Action orchestration (which actions are available, what happens on click) lives in web-core hooks/controllers; presentation model lives in web-ui.
- Keep presentation components stateless where possible; use controlled props.
