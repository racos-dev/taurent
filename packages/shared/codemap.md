# packages/shared/

## Responsibility

Platform-agnostic core of the monorepo. Provides canonical domain types, Zod validation schemas, pure utilities, Zustand stores, theme tokens, icon system, and minimal UI primitives (Icon, StatusBadge). Intentionally free of Tauri or native bindings.

## Source Structure

```
packages/shared/src/
├── index.ts                    # Root barrel re-exports
├── types/
│   ├── qbittorrent.ts          # API-first types (Torrent, Preferences, TransferInfo, etc.)
│   ├── server.ts               # Server type
│   ├── auth.ts                 # Auth types
│   └── globals.ts              # Global Window type augmentations (__TAURENT_WINDOW_LABEL__)
├── schemas/
│   ├── qbittorrent.ts          # Zod schemas for API responses
│   └── addTorrent.ts           # Add-torrent form validation
├── utils/
│   ├── sortTorrents.ts         # Torrent sorting logic
│   ├── maindata.ts             # Maindata derivation helpers
│   ├── validation.ts           # Validators.* — Zod safeParse wrappers
│   ├── logger.ts               # Logging utilities
│   ├── server-url.ts           # Server URL normalization
│   ├── torrentFilter.ts        # Torrent filtering logic
│   ├── torrentStatus.ts        # Status labels and color mapping
│   ├── formatters.ts           # Date, size, speed formatters
│   ├── deriveTorrentList.ts    # Derived torrent list computation
│   ├── deriveTrackerEntries.ts # Tracker entry derivation
│   ├── cn.ts                   # clsx + tailwind-merge utility
│   ├── perfAudit.ts            # Performance audit hooks (measure, count, flush)
│   └── error.ts                # Error normalization
├── stores/
│   ├── torrentStore.ts         # Zustand store for torrent domain state
│   ├── uiStore.ts              # Zustand store for UI-local state
│   └── index.ts                # Store re-exports
├── theme/
│   ├── tokens.ts               # Tailwind CSS semantic tokens (bg-surface, text-primary, etc.)
│   ├── registry.ts             # Theme palette registry
│   ├── resolver.ts             # Theme variant resolver
│   ├── helpers.ts              # Theme utility helpers
│   ├── types.ts                # ThemePalette, ThemeVariant, AccentHex, AccentPreference types
│   ├── accent.ts               # Accent color normalization + Midnight accent token derivation
│   ├── background.ts           # Node-safe static data + CSS injection generators (incl. accent init script)
│   ├── backgroundRuntime.ts    # Browser-only runtime resolver (localStorage/matchMedia)
│   ├── motion.ts               # Animation/motion tokens + usePrefersReducedMotion hook
│   ├── themes.css              # CSS custom property definitions
│   └── index.ts                # Re-exports motion + accent
├── icons/
│   ├── index.ts                # Lucide icon re-exports
│   ├── custom.tsx              # Custom icons (RatioIcon, etc.)
│   └── sizes.ts                # ICON_SIZES constant (xs/sm/md/lg/xl)
├── components/
│   ├── Icon/
│   │   ├── Icon.tsx            # Icon component with iconSize prop
│   │   └── codemap.md
│   └── StatusBadge/
│       ├── StatusBadge.tsx     # StatusBadge + StatusDot components
│       └── codemap.md
├── constants/
│   └── connection.ts           # Connection-related constants
├── platform/
│   └── index.ts                # PlatformStorage interface, PlatformNotificationType
├── server/
│   ├── index.ts                # Server-related shared code
│   ├── serverId.ts             # Server ID helpers
│   ├── serverTypes.ts          # Server type definitions
│   ├── validation.ts           # Server validation
├── settings/
│   ├── index.ts                # Settings-related shared code
│   ├── parityMap.ts            # Parity mapping utilities
│   ├── remoteSettings.ts       # Remote settings management
│   ├── remoteSettingsSections.ts  # Remote settings section definitions
│   └── remoteSettingsHelpers.ts   # Settings normalization, dirty-state, and coercion helpers
```

## Design Patterns

- **API-first typing**: TypeScript interfaces and enums mirror qBittorrent Web API responses; Zod schemas provide runtime validation to bridge compile-time types with external API inputs.
- **Pure utilities**: All helpers in `src/utils/` are side-effect-free and safe for use in web-core; they avoid platform bindings.
- **State-as-source-of-truth**: Zustand stores (`torrentStore`, `uiStore`) expose domain state and explicit action functions. `torrentStore` provides `getSortedTorrents()` as a convenience getter.
- **Builder pattern**: `FormDataBuilder` implements a fluent builder for multipart payloads (add-torrent).
- **Theme token system**: Semantic Tailwind tokens (`bg-surface`, `text-text-primary`) rather than literal color classes.

## Public Export Surface (`src/index.ts`)

- **Types**: `qbittorrent` (full API types), `Server`, auth types
- **Schemas**: `qbittorrent`, `addTorrent`
- **Constants**: `connection`
- **Theme**: `helpers`, `registry`, `resolver`, `tokens`, `motion`, `accent` (`normalizeAccent`, `isAccentValue`, `deriveMidnightAccentTokens`, `getContrastText`, `serializeAccentCss`), `ThemePalette`, `ThemeVariant`, `AccentHex`, `AccentPreference`
- **Platform**: `PlatformStorage`, `PlatformNotificationType`
- **Utils**: `sortTorrents`, `maindata`, `validation`, `logger`, `server-url`, `torrentFilter`, `torrentStatus`, `formatters`, `deriveTorrentList`, `deriveTrackerEntries`, `cn`, `perfAudit`
- **Icons**: `ICON_SIZES`, `Icon`, `StatusBadge`, `StatusDot`, `RatioIcon`

## Integration

- **Consumed by**: `@taurent/web-core`, `@taurent/web-ui`, `@taurent/bridge` (types), `apps/desktop`, `apps/mobile`.
- **Depends on**: `clsx`, `tailwind-merge`, `zod`, `zustand`, `lucide-react` (peer: `react`).
- **Must NOT**: Import `@tauri-apps/*`. All native interactions belong to bridge/apps.

## Data Flow

1. Network response → Zod validation (`Validators.*` from `utils/validation.ts`)
2. Validated data → React Query cache (via `@taurent/web-core` QueryClient) or Zustand stores
3. UI components consume types, formatters, and status helpers for presentation
4. Mutations use optimistic-update utilities from `@taurent/web-core`

## Key Constraints

- No Tauri-native side-effects in this package.
- No React Query client creation here; `createQueryClient()` moved to `@taurent/web-core/query`.
- No UI primitives (Button, Card, etc.); those live in `@taurent/web-ui`.
- Always run Zod validators before handing external data to stores or components.
