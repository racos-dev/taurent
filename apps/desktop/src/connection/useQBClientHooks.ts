// Re-export hooks from the single bootstrap instance in QBClientProvider.
// This ensures all hooks read from the same React context.
// Do NOT create a second createQBClientBootstrap() here — that would introduce
// a separate context instance that QBClientProvider consumers can't reach.
export { useQBClient, useMaindataState, useMaindataSelector } from './QBClientProvider';