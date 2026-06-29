# InspectorSection

## Responsibility

Titled section container for the right inspector panel, with bottom border separators between sections.

## Design

`React.memo` component. Renders padding, optional title, and child content. Applies `border-b` for visual separation. The `last:border-b-0` class removes the border on the final section.

## Flow

Pure presentational. No state.

## Integration

Used in desktop workspace layouts to structure the right inspector/detail panel content.
