# CommandBar

## Responsibility

Horizontal toolbar container for action buttons and grouped controls, rendered as a bottom-bordered bar.

## Design

`React.memo` components. `CommandBar` renders a flex row with gap and border. `CommandBarGroup` nests a flex row of items within the bar. Both accept `className` for customization.

## Flow

Pure presentational — accepts children and renders them in a flex row. No state.

## Integration

Used in screen bodies for toolbar areas (e.g., search screen toolbar, settings toolbar).
