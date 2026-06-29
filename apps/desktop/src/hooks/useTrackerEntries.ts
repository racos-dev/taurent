// Desktop tracker entries hook — delegates to web-core's createTrackerEntriesHook factory.
// Re-export only; all logic lives in @taurent/web-core.

import { useMaindataState } from '../connection/QBClientProvider';
import { createTrackerEntriesHook } from '@taurent/web-core/hooks';

export const useTrackerEntries = createTrackerEntriesHook(useMaindataState);

