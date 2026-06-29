# packages/web-ui/src/components/shared/Toast/

## Responsibility

Provides a thin wrapper around the `sonner` toast library with deduplication support and theme-aware styling. Exports a `toast` instance for programmatic toast notifications and a `Toaster` React component for rendering the toast viewport.

## Design

- **`toast.ts`** — wraps `sonner`'s `toast` function with custom deduplication logic:
  - `ToastOptions` extends `ExternalToast` with optional `dedupeKey`.
  - `resolveToastId()` generates a stable ID from `kind:message` (normalized) or `kind:dedupeKey`, preventing duplicate toasts for the same message.
  - Overrides `sonnerToast.error()` to apply `error:` prefix to dedup IDs.
  - The exported `toast` object spreads all sonner methods (success, warning, info, etc.) plus the customized `error`.
- **`Toaster.tsx`** — renders `<SonnerToaster>` configured with:
  - Position: `bottom-right`.
  - Max visible toasts: 3.
  - Theme-aware styles using CSS custom properties (`--color-surface-elevated`, `--color-text-primary`, `--color-border`).

## Flow

1. Any module imports `toast` from `@taurent/web-ui` (or local path) and calls `toast('Message')`, `toast.error('Error')`, etc.
2. `Toaster` component mounted at app root renders the toast viewport.
3. Deduplication: second call with same message within dedup window updates existing toast instead of creating a new one.

## Integration

- **`sonner`** — external dependency; `toast.ts` and `Toaster.tsx` are thin wrappers.
- **App shells** — both desktop and mobile app roots mount `<Toaster />` and use `toast()` for user feedback (success/error/info).
- **No index.ts** — files are imported directly: `import { toast } from './Toast/toast'` and `import { Toaster } from './Toast/Toaster'`.
