# PluginInstallDialog

## Responsibility

Modal dialog for installing a search plugin by entering a source URL.

## Design

`React.memo` component wrapping `Dialog` + `Input` + `DialogActions`. Manages internal URL state. Controlled via `isOpen`/`onClose` props (unlike most other dialogs which are always-open). Resets URL on close.

## Flow

Open/close controlled by parent. `onInstall(url)` fires on confirm with trimmed URL. `isPending` disables actions.

## Integration

Used by `SearchScreenBody` for installing search plugins.
