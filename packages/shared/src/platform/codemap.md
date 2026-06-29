# packages/shared/src/platform/

## Responsibility

Platform abstraction interfaces for platform-specific functionality. Defines contracts for storage and notifications that are implemented differently by each platform (desktop Tauri, mobile Tauri, web). This allows shared code to remain platform-agnostic while enabling platform-specific implementations.

## Key Files

- `index.ts` — Exports:
  - `PlatformStorage` interface: `getItem(key: string): Promise<string | null>`, `setItem(key: string, value: string): Promise<void>`, `deleteItem(key: string): Promise<void>`.
  - `PlatformNotificationType`: `'toast' | 'native'`.

## Design

- **Interface contracts**: Abstract storage and notification type definitions with no implementation — pure type-level abstractions.
- **Platform implementation**: Each platform implements these interfaces via `@taurent/bridge` or platform-specific adapters.
- **Abstraction boundary**: shared stays platform-agnostic; Tauri-specific implementations live in `@taurent/bridge` or app-level platform modules.

## Integration

- Platform implementations live in each app's platform adapter (desktop, mobile).
- Used by server management and settings storage in both apps for credential and preference persistence.
- Storage abstraction enables secure credential storage on each platform (Keychain on desktop, SecureStore on mobile).
- `PlatformNotificationType` used by desktop for notification routing (toast vs native OS notifications).
- Exported from `packages/shared/src/index.ts` as `export * from './platform'`.
