// sync module - backend-owned live sync for hot state

export { useSelectedTorrentDetailSync, type UseSelectedTorrentDetailSyncOptions } from './useSelectedTorrentDetailSync';
export {
  MaindataSyncProvider,
  useMaindataState,
  useMaindataSelector,
  type MaindataSyncBackendBridge,
  type MaindataSyncScope,
  type MaindataSyncContextValue,
  type MaindataSyncProviderProps,
} from './MaindataSyncProvider';
export {
  useMaindataSyncBackend,
  isMaindataSyncDegraded,
  type MaindataSyncBridgeSurface,
  type UseMaindataSyncBackendOptions,
  type UseMaindataSyncBackendResult,
  type MaindataSyncHealth,
  type MaindataSyncHealthStatus,
} from './useMaindataSyncBackend';
export {
  type ProtectedRequestHealth,
  type ProtectedRequestHealthStatus,
  isProtectedRequestDegraded,
  reportProtectedFailure,
  reportProtectedSuccess,
  clearHealthStore,
} from './protectedRequestHealth';
export {
  useConnectionHealth,
  type ConnectionHealth,
  type ConnectionHealthState,
  type UseConnectionHealthOptions,
} from './useConnectionHealth';
export {
  useWorkspaceView,
  type UseWorkspaceViewResult,
  type WorkspaceViewBridge,
  type WorkspaceViewClientBridge,
} from './useWorkspaceView';
