# packages/web-ui/src/components/shared/

## Responsibility

Cross-domain presentation helpers used across multiple screens and component families. Includes loading states, empty states, error states, data display containers, and toast notifications.

## Design

- **StateCard**: Compact inline empty/error state card for when a child container has no content. Solid border, compact padding, single action slot.
- **StateSurface**: Full-area placeholder for when an entire content region is empty, loading, or errored. Dashed double border, spacious padding, tone-aware border coloring, multiple actions.
- **StatusPanel**: Simple titled status message with optional error tone.
- **RemoteSectionContainer**: Orchestrator for remote settings sections — handles no-server, loading, connection error, data error, save error, and ready states. Wraps children when preferences are available.
- **SettingToggle**: Checkbox + label + description row for boolean settings.
- **InfoRow**: Label + value display row for read-only metadata.
- **SkeletonBlock**: Animated pulse placeholder for loading states. Configurable width, height, radius, and background.
- **Spinner**: Loading indicator with `ring` (CSS border animation) and `icon` (RefreshCw rotation) variants. Three sizes.
- **RetryButton**: Outline button for retrying failed operations.
- **SurfaceList**: Divided list container using `divide-y`.
- **SurfaceListItem**: Clickable/interactive list item with selected state support.
- **MetadataList**: Vertical spacing container for metadata rows.
- **MetadataRow**: Label + value row for metadata display with consistent alignment.
- **MetricCard**: Labeled value card with tone-aware border coloring (neutral/success/warning/error).
- **MutationErrorBanner**: Inline error banner for mutation failures. Uses `formatUserMessage` from shared utils.
- **Toast/Toaster**: Toast notification system. `toast()` function creates notifications. `Toaster` renders the toast stack. Uses `sonner` library under the hood.

## Flow

All shared components are pure presentational — they receive data via props and render appropriate UI. `RemoteSectionContainer` is the most complex, orchestrating multiple loading/error/ready states.

## Integration

Consumed by all screen bodies, settings panels, management components, and server-setup flows. Foundation for consistent state presentation across the app.
