# filters

## Responsibility

Headless controller for FiltersScreen filter state management. Owns all filter selection state (status, category, tag, tracker), URL param initialisation, section expand/collapse, long-press delete confirm dialogs, and apply/close/clear navigation callbacks.

## Key Files

- `useFiltersScreenController.ts` — Main controller hook with filter selection, section toggle, confirm dialog, and navigation callbacks

## Design Patterns

- **URL-driven initial state**: `initialValues` are parsed from URL search params by the app route
- **Section expand/collapse**: Manages `expandedSections` state for filters, categories, tags, trackers sections
- **Long-press delete (mobile)**: `handleCategoryLongPress`/`handleTagLongPress` open confirm dialog with destructive tone
- **Passthrough form state**: Receives `formState` from `useFiltersFormState` (category/tag add/delete handlers) and passes through to UI
- **Navigation callbacks**: `onClose(filters)` and `onClear()` are injected so apps can wire their own navigation

## Flow

1. App route parses URL params into `initialValues`
2. Controller initializes selection state from initial values
3. User toggles filters/categories/tags/trackers
4. `handleClose()` passes current selections to `onClose` callback
5. `handleClearFilters()` resets all selections and calls `onClear`

## Integration

- Imports `TorrentFilterType`, `TrackerEntry` from `@taurent/shared`
- Imports `UseFiltersFormStateResult` from `hooks/useFiltersFormState`
- Used by desktop/mobile FiltersScreen routes
- Consumes form actions from `useCategories`/`useTags` mutation hooks
