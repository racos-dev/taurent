# apps/desktop/src/platform/

## Responsibility

Provides platform-specific abstractions for desktop (Tauri). Currently provides persistent storage using Tauri plugin-store and notification type identification.

## Key Files

- **index.ts** — Exports storage object and notificationType constant

## Design Patterns

- **Tauri Store**: Uses @tauri-apps/plugin-store for persistent key-value storage
- **Singleton Store**: Creates single Store instance on first access, reuses for subsequent calls
- **Auto-Save Mode**: Stores with autoSave: false, explicit save() calls after each mutation
- **Storage Interface**: Provides getItem, setItem, deleteItem methods matching browser Storage API

## Integration

- Used by zustand/middleware for persisting shellStore state (conceptually)
- notificationType: 'native' indicates native desktop notifications
- Imports from @tauri-apps/api (not used directly in index.ts but the store is Tauri-specific)
