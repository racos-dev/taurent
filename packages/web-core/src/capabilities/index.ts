// capabilities module - server capability discovery (Rust single source of truth)
//
// Capabilities arrive inside every `SessionSnapshot` (see `ServerCapabilities`
// in `@taurent/bridge/types`) — there is no separate bridge call. The web-core
// layer consumes them via the camelCase `AppCapabilities` shape defined in
// `./generated/app-capabilities`.

export type { AppCapabilities } from './generated/app-capabilities';
export {
  DEFAULT_APP_CAPABILITIES,
  toAppCapabilities,
  makeAppCapabilities,
  CAPABILITY_ADDED_IN,
  CAPABILITY_REMOVED_IN,
} from './generated/app-capabilities';

export { getCapabilityStatus } from './getCapabilityStatus';
export type { CapabilityStatus, CapabilityName } from './getCapabilityStatus';
