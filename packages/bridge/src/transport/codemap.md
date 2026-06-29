# packages/bridge/src/transport/

## Responsibility

Provides the platform-agnostic `Transport` interface and its sole production implementation (`createTauriTransport`). This is the IPC boundary layer — the only place where `@tauri-apps/api` invoke/listen calls originate. All higher-level bridge code goes through this abstraction.

## Files

- **transport.ts** — Platform-agnostic transport contract. Defines the `Transport` interface, `TransportFactory` type, `UnlistenFn` type, and `createTransportWithFactory` helper.
- **tauriTransport.ts** — Tauri-specific transport implementation. The single location for `@tauri-apps/api/core` (invoke) and `@tauri-apps/api/event` (listen) imports. Implements `createTauriTransport()`, `invokeWrap`, `tauriInvoke`, and typed event listener creators including `createMaindataSyncChangedListener`.
- **tauri.ts** — Convenience re-export barrel for `tauriTransport.ts`.
- **index.ts** — Barrel re-export of both `transport` and `tauriTransport`.

## Design

### Transport Interface (`transport.ts`)

```typescript
interface Transport {
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
  listen<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn>;
}
```

- **Minimal contract**: Only two methods — `invoke` (request/response) and `listen` (event subscription). Any platform (Tauri, web fetch, gRPC) can implement this.
- **UnlistenFn**: Cleanup function returned by `listen()` to unsubscribe from events. Same signature as `@tauri-apps/api/event`'s `UnlistenFn`.
- **TransportFactory**: `() => Transport` type for dependency injection patterns.
- **createTransportWithFactory**: Convenience wrapper that returns both a transport instance and its factory, useful for DI containers.

### Tauri Transport (`tauriTransport.ts`)

- **invokeWrap**: Wraps a Tauri invoke promise to normalize errors — non-Error throws are re-thrown as `new Error(String(e))`.
- **tauriInvoke**: Typed invoke wrapper that calls `invokeWrap(invoke<T>(cmd, args))`. This is the low-level primitive used by all bridge adapters.
- **createTauriTransport**: Factory that returns a `Transport` object. Delegates `invoke` to `tauriInvoke` and `listen` to Tauri's `listen` (unwrapping `event.payload`).
- **Event listener creators**: Typed factory functions for specific bridge events:
  - `createSessionEventListener(callback)` — listens for `'session-changed'` events
  - `createResourceInvalidatedListener(callback)` — listens for `'resource-invalidated'` events
  - `createOperationFailedListener(callback)` — listens for `'operation-failed'` events
  - `createThemeChangedListener(callback)` — listens for `'theme-changed'` events
  - `createMaindataSyncChangedListener(callback)` — listens for `'maindata-sync-changed'` events (Rust-owned live sync)
- **NativeNotificationPayload**: Interface for `{ title, body }` notification payloads, consumed by `desktop/notification.ts`.

## Flow

```
Bridge adapter (adapters/desktop.ts or adapters/mobile-tauri.ts)
  → transport.invoke(cmd, args)
    → createTauriTransport().invoke
      → tauriInvoke(cmd, args)
        → invokeWrap(invoke<T>(cmd, args))   [@tauri-apps/api/core]
          → Rust command handler (qb-tauri)

Event subscription:
Bridge consumer (web-core hooks, app code)
  → createSessionEventListener(callback)
    → listen<SessionChangedEvent>('session-changed', ...)  [@tauri-apps/api/event]
      → callback(event.payload)     [invoked by Tauri event bus]

Maindata sync events:
Rust sync manager
  → maindata-sync-changed event
    → createMaindataSyncChangedListener(callback)  [@tauri-apps/api/event]
      → callback(event.payload)
```

## Integration

- **Single Tauri dependency point**: `tauriTransport.ts` is the only file in the bridge package that directly imports `@tauri-apps/api`. This enforces the platform boundary.
- **Consumed by adapters**: Both `adapters/desktop.ts` and `adapters/mobile-tauri.ts` import `createTauriTransport` for the default transport and `Transport` type for injection.
- **Consumed by shared bridge**: `sharedBridge.ts` operates on the `Transport` interface, not Tauri-specific code.
- **Event creators consumed by app code**: The typed event listener creators (`createSessionEventListener`, `createMaindataSyncChangedListener`, etc.) are re-exported from the package root and consumed directly by desktop/mobile app initialization code and `packages/web-core` hooks.
- **Web placeholder**: `web.ts` (in parent directory) documents how a web transport would implement the `Transport` interface using fetch/WebSocket, but is not yet implemented.
