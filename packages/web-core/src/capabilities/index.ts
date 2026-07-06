// capabilities module - server capability discovery (Rust single source of truth)
//
// Capabilities arrive inside every `SessionSnapshot` (see `ServerCapabilities`
// in `@taurent/bridge/types`) — there is no separate bridge call. The web-core
// layer consumes them via the camelCase `AppCapabilities` shape defined in
// `./types`.

export type { AppCapabilities } from './types';
export { DEFAULT_APP_CAPABILITIES, toAppCapabilities } from './types';
