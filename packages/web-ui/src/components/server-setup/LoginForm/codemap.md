# LoginForm

## Responsibility

Login form for connecting to an existing qBittorrent server with URL, username, and password.

## Design

`React.memo` `LoginFormBody` component. Uses `ServerConnectionFields` (without name field). Shows `locationError` and `connectError` messages, with special CORS error detection for browser mode. Submit button shows "Connecting..." during `isConnecting`.

## Flow

All form state controlled via props. Submit triggers parent's connect handler. No internal state.

## Integration

Used by desktop and mobile login screens.
