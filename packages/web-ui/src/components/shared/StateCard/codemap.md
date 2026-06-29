# packages/web-ui/src/components/StateCard/

## Responsibility

State display component for showing empty, loading, or error states with optional icon, title, message, and action button.

## Key Files

- `StateCard.tsx` - Main component
- `types.ts` - StateCardProps interface
- `index.ts` - Barrel export

## Design Patterns

- **Centered layout**: Text centered with optional icon and action buttons
- **Optional icon**: Renders icon in circular container if provided
- **Flexible content**: Accepts ReactNode for action prop
- **React.memo**: Memoized for performance

## Integration

- Used for empty states, loading states, error states throughout the app
- Props: title, message (optional), action (optional, ReactNode), icon (optional, ReactNode), className
