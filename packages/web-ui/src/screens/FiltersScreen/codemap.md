# packages/web-ui/src/screens/FiltersScreen/

## Responsibility

Provides the platform-agnostic presentational body for the filter side-panel/screen. Renders four collapsible filter sections — status, categories, tags, and trackers — plus inline add-category/add-tag forms and a mobile long-press confirm dialog. Pure UI: all data and callbacks arrive via props.

## Design

- **`FiltersScreenBody`** — top-level `React.memo` component receiving `FiltersScreenBodyProps`. Composes `SettingsSection`, `FilterStatusList`, `FilterCategorySection`, `FilterTagSection`, `FilterTrackerSection`, and `ConfirmDialog`.
- **Types module (`types.ts`)** — defines `FiltersScreenBodyProps`, `FiltersScreenBodyFilterState`, `FiltersScreenBodySectionState`, and `FiltersScreenBodyConfirmDialog`. Imports `TorrentFilterType` and `TrackerEntry` from `@taurent/shared`.
- **Icons passed from shell** — an `icons` prop (`{ filter, folder, tag, globe, settings }`) avoids importing platform-specific Lucide icons directly, keeping the module web-core-agnostic.
- **Section expand/collapse** — controlled via `expandedSections` (a `FiltersScreenBodySectionState` boolean map) and `onToggleSection`.
- **Long-press delete (mobile)** — `onCategoryLongPress` / `onTagLongPress` open a `ConfirmDialog` driven by `confirmDialog` prop; the body does not manage the dialog state itself.

## Flow

1. Controller (web-core hook) selects filter state → passes `selectedFilter`, `selectedCategory`, `selectedTag`, `selectedTracker` as props.
2. User taps a status/category/tag/tracker → `onFilterSelect` / `onCategoryChange` / `onTagChange` / `onTrackerChange` callback fires, controller updates global filter state.
3. User toggles section → `onToggleSection('categories')` etc. → controller toggles `expandedSections`.
4. User types a new category/tag name → controlled inputs (`newCategoryName` / `newTagName`) → `onSubmitAddCategory` / `onSubmitAddTag` fires create mutation.
5. Mobile long-press → `onCategoryLongPress` / `onTagLongPress` sets `confirmDialog` in controller → confirm/cancel closes dialog.

## Integration

- **`@taurent/web-ui`** — consumes `SettingsSection`, `FilterStatusList`, `FilterCategorySection`, `FilterTagSection`, `FilterTrackerSection`, `ConfirmDialog`.
- **`@taurent/shared`** — imports `TorrentFilterType`, `TrackerEntry` types.
- **Controller layer** — all mutation pending states (`createCategoryIsPending`, `removeCategoriesIsPending`, `createTagsIsPending`) and optional navigation slots (`manageCategoriesAction`, `manageTagsAction`) are injected by the platform-specific controller (web-core hook).
- **Exported from `index.ts`**: `FiltersScreenBody` component and all types.
