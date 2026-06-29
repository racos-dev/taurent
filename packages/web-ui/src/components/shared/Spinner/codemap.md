# Spinner

## Responsibility

Loading indicator with ring (CSS border) and icon (RefreshCw rotation) variants.

## Design

`React.memo` component. Ring variant: `animate-spin` border circle. Icon variant: spinning `RefreshCw` icon. 3 sizes: sm (12px), md (16px), lg (48px/20px). `aria-hidden="true"`.

## Flow

Pure presentational. No state.

## Integration

Used throughout the UI in buttons, loading states, and inline indicators.
