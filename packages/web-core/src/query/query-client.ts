import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { createLogger } from '@taurent/shared/utils/logger';
import { reportProtectedFailure, reportProtectedSuccess } from '../sync/protectedRequestHealth';

const logger = createLogger({ component: 'QueryClient' });

/**
 * Create optimized QueryClient configuration
 */
export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Log query errors
        logger.error(`${query.queryKey.join('/')}:`, error);
        // Report protected query failures for connected-server outage detection
        reportProtectedFailure(query.queryKey, error);
      },
      onSuccess: (_data, query) => {
        // Report protected query success to clear outage state
        reportProtectedSuccess(query.queryKey);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        // Log mutation errors
        logger.error('Mutation error:', error);
      },
    }),
    defaultOptions: {
      queries: {
        // Stale time - data is considered fresh for 30 seconds
        staleTime: 1000 * 30,

        // Garbage collection time - unused data is cached for 5 minutes
        gcTime: 1000 * 60 * 5,

        // Retry failed queries 3 times
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

        // Don't refetch on window focus (mobile apps don't need this)
        refetchOnWindowFocus: false,

        // Refetch on reconnect
        refetchOnReconnect: true,

        // Error handling
        throwOnError: false,

        // Network mode
        networkMode: 'online',
      },
      mutations: {
        // Retry failed mutations once
        retry: 1,
        retryDelay: 1000,

        // Network mode
        networkMode: 'online',
      },
    },
  });
}

// Default query options for specific data types
export const queryOptions = {
  // Real-time data that changes frequently (torrents, transfer info)
  realTime: {
    staleTime: 3000, // 3 seconds - balances responsiveness with reduced network noise
    gcTime: 1000 * 60, // 1 minute
  },

  // Semi-static data (categories, tags, preferences)
  semiStatic: {
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 10, // 10 minutes
  },

  // Static data (app version, build info)
  static: {
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60, // 1 hour
  },

  // User data (servers list)
  userData: {
    staleTime: 1000 * 5, // 5 seconds
    gcTime: 1000 * 60 * 5, // 5 minutes
  },
};

// Helper to merge default options with custom options
export function mergeQueryOptions<T>(
  type: keyof typeof queryOptions,
  customOptions?: Partial<T>
): T {
  return {
    ...queryOptions[type],
    ...customOptions,
  } as T;
}
