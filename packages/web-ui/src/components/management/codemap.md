# packages/web-ui/src/components/management/

## Responsibility

List and admin-style UI components for managing torrent filters, categories, tags, and inline creation/composition workflows.

## Design

- **Composer**: Inline input + add/cancel buttons for creating new items (tags, categories). Supports Enter to submit, Escape to cancel. Uses `Input` and `Button` primitives.
- **FilterListItem**: Selectable button row with icon, label, summary, checkmark, and long-press support (400ms threshold). Density-aware sizing via `controlSizing`. Used for all filter list items.
- **FilterStatusList**: Renders a list of `FilterListItem` components for status filter options (All, Downloading, Seeding, etc.).
- **FilterTagSection**: Tag filter section with "All Tags" option, individual tag items, inline add form, refresh button (`IconButton`), and delete confirmation dialog. Supports `pill` (desktop) and `list` (mobile) layouts.
- **FilterCategorySection**: Category filter section with "All Categories" option, individual category items, inline add form, refresh button (`IconButton`), and delete confirmation dialog. Supports `pill` and `list` layouts.
- **FilterTrackerSection**: Tracker filter section with "All Trackers" option and individual tracker items showing hostname and torrent count.
- **ManageCategoriesBody**: Full-page category management UI with create, edit (save path), and delete operations. Desktop and mobile variants. Uses `MutationErrorBanner` for mutation error display.
- **ManageTagsBody**: Full-page tag management UI with create and delete operations. Desktop and mobile variants. Uses `MutationErrorBanner` for mutation error display.

## Flow

All components are controlled — they receive data and callbacks via props. Filter sections manage their own add form visibility and delete confirmation state internally. Management bodies manage inline edit state internally but delegate mutations to parent callbacks.

## Integration

Consumed by `FiltersScreenBody` for sidebar filter management, and by app shells in dedicated management screens. `ManageCategoriesBody` and `ManageTagsBody` are exported from `src/index.ts`.
