# MutationErrorBanner

## Responsibility

Inline error banner for displaying mutation failure messages.

## Design

Functional component (not memoized). Returns `null` when no error. Uses `formatUserMessage` from `@taurent/shared/utils/error` to normalize error display. Renders alert icon + message in a red-tinted container.

## Flow

Renders based on `error` prop. No internal state.

## Integration

Used by `CategorySelectionDialog`, `TagSelectionDialog`, `ManageCategoriesBody`, `ManageTagsBody`, and other mutation UIs.
