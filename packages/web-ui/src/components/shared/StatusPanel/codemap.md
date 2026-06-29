# packages/web-ui/src/components/shared/StatusPanel/

## Responsibility

A simple presentational component that displays a titled status message with an optional error tone. Used for inline status feedback within settings, preferences, or other panels.

## Design

- **`StatusPanel`** — `React.memo` component (`StatusPanelProps`). ~25 lines.
- **Props**:
  - `title: string` — bold headline.
  - `description: string` — supporting text.
  - `tone?: 'default' | 'error'` — controls border/background/text color (error uses `border-error`, `bg-error-20`, `text-error`).
- **Styling** — rounded border, surface background, responsive text sizes (`text-sm` title, `text-xs` description).
- **No internal state or callbacks** — pure display component.

## Flow

1. Parent passes `title`, `description`, `tone`.
2. Component renders; no interactions.

## Integration

- **`@taurent/shared`** — `cn`.
- **Used by** — settings panels, preference sections, or any UI needing a simple status callout.
- **Exported from `index.ts`**: `StatusPanel`, `StatusPanelProps`.
