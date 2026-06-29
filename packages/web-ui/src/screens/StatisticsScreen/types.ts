// Types for StatisticsScreen shared body

export interface ServerStatistics {
  alltimeDl: number;
  alltimeUl: number;
  averageTimeQueue: number;
  globalRatio: number;
  queuedIoJobs: number;
  readCacheHits: number;
  readCacheOverload: number | string | null;
  totalBuffersSize: number;
  totalPeerConnections: number;
  totalQueuedSize: number;
  totalWastedSession: number;
  writeCacheOverload: number | string | null;
}

export interface StatisticsScreenBodyProps {
  /** Derived statistics from server_state, or null if not connected */
  statistics: ServerStatistics | null;
  /** True when maindata is still loading on first connect */
  isLoading: boolean;
  /** True when connected to a server */
  isConnected: boolean;
  /** Optional override for the outer content container className (e.g. to change max-width on mobile) */
  contentClassName?: string;
}
