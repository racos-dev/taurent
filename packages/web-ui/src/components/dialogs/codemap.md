# packages/web-ui/src/components/dialogs/

## Responsibility

Modal dialog primitives and workflow-specific dialogs for user confirmations, inputs, and multi-step actions.

## Design

- **Dialog**: Core modal shell with backdrop, animated open/close phases (`open` → `closing` → `closed`), Escape key handling, body scroll lock, and configurable `maxWidth`.
- **DialogActions**: Renders a row or stack of `Button` components for dialog footers.
- **ConfirmDialog**: Async-aware confirmation with loading state, danger/default tone, and auto-close on success.
- **InputDialog**: Text input modal with submit/cancel.
- **NumberInputModal**: Numeric input with unit label.
- **DeleteTorrentDialog**: Three-action delete dialog (torrent only, torrent + files, cancel).
- **CategorySelectionDialog**: Single-select category picker.
- **TagSelectionDialog**: Multi-select tag picker with add/remove operations.
- **FilePriorityDialog**: Single-select file priority picker.
- **PluginInstallDialog**: URL input for search plugin installation.

## Flow

All dialogs are controlled via `isOpen`/`onClose` props from the parent. They render nothing when closed. Internal state handles animation phases and form values. Submit actions call parent callbacks and the parent manages closing.

## Integration

Consumed by screen bodies (`HomeScreenBody`, `TorrentDetailScreenBody`, `SearchScreenBody`, `RSSScreenBody`, `FiltersScreenBody`) and management components (`ManageCategoriesBody`, `ManageTagsBody`).
