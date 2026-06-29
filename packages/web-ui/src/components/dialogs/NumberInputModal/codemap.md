# NumberInputModal

## Responsibility

Modal dialog for numeric input with a unit label and submit/cancel actions.

## Design

`React.memo` component wrapping `Dialog` + `NumberInput` + `DialogActions`. Manages internal string state for the input value. Parses to integer on submit.

## Flow

Always open. `onSubmit(parsedInt)` fires on confirm. `onCancel` dismisses. Optional `unit` label displayed below input.

## Integration

Used by `HomeScreenBody` (speed limit editing), `TransferSettingsPanel`, `QueueSettingsPanel`, and `RemoteSettingsPanel` for numeric preference editing.
