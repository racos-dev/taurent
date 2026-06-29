# InputDialog

## Responsibility

Modal dialog for text input with submit/cancel actions and Enter key support.

## Design

`React.memo` component wrapping `Dialog` + `DialogActions` + `Input`. Controlled value via props. Submit is disabled when value is empty or `isPending`. Enter key triggers submit.

## Flow

Always open. `onSubmit` fires on button click or Enter. `onCancel` dismisses. `isPending` shows loading label.

## Integration

Used by `TorrentDetailScreenBody` for rename operations.
