# apps/desktop/src/contexts/

## Responsibility

Provides desktop-specific React contexts for cross-component communication. Currently contains the `SearchFocusContext` — a ref-based mechanism that lets keyboard shortcuts (Ctrl+F) focus the toolbar search input from anywhere in the component tree.

## Design

- **Ref-based context**: `SearchFocusProvider` holds a single `useRef<HTMLInputElement>` and exposes `registerSearchInput`, `unregisterSearchInput`, and `focusSearch` functions. This avoids re-renders when the ref changes.
- **Hook layer**: `useSearchFocusContext` provides safe context access with a guard. `useSearchInputRef` returns a ref-callback for attaching to the input element. `useFocusSearch` returns a stable focus function for keyboard shortcuts.
- **Singleton scope**: The provider is mounted once at the app shell level; all children share the same search input reference.

## Flow

1. `SearchFocusProvider` wraps the app shell.
2. `MainToolbar` renders a search `Input` with `ref={useSearchInputRef()}` — the ref-callback registers the DOM element.
3. A keyboard shortcut handler calls `useFocusSearch()` → `focusSearch()` → `ref.current.focus()`.
4. On unmount, `unregisterSearchInput()` clears the ref.

## Integration

- Used by `MainToolbar` (register) and `useKeyboardShortcuts` (focus).
- No external dependencies beyond React's `createContext`/`useContext`/`useRef`.
