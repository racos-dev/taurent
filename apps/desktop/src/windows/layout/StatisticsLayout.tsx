import { useQBClient, useMaindataState } from '../../connection';
import { createServerStatisticsHook } from '@taurent/web-core/hooks';
import { StatisticsScreenBody } from '@taurent/web-ui/screens/StatisticsScreen/StatisticsScreenBody';
import type { ServerStatistics } from '@taurent/web-ui/screens/StatisticsScreen/types';

const useServerStatistics = createServerStatisticsHook(useMaindataState);

export function StatisticsLayout() {
  const { isConnected } = useQBClient();
  const { statistics, isLoading } = useServerStatistics();

  return (
    <StatisticsScreenBody
      statistics={statistics as ServerStatistics | null}
      isLoading={isLoading}
      isConnected={isConnected}
    />
  );
}
