// Mobile StatisticsScreen route — thin shell with sticky header.
// Business logic lives in useServerStatistics hook (web-core);
// presentational body in StatisticsScreenBody (web-ui).

import { useQBClient, useMaindataState } from '../connection/QBClientProvider';
import { createServerStatisticsHook } from '@taurent/web-core/hooks';
import { ScreenHeader, StatisticsScreenBody, type ServerStatistics } from '@taurent/web-ui';
import { useNavigate } from 'react-router-dom';
import { mobileScreenRootClassName } from '../ui/mobileScreenLayout';
import { useTaurentTranslation } from '@taurent/shared/i18n';

const useServerStatistics = createServerStatisticsHook(useMaindataState);

export function StatisticsScreen() {
  const { t } = useTaurentTranslation('statistics');
  const navigate = useNavigate();
  const { isConnected } = useQBClient();
  const { statistics, isLoading } = useServerStatistics();

  return (
    <div className={mobileScreenRootClassName({ height: 'full' })}>
      <ScreenHeader
        title={t('title')}
        subtitle={t('subtitle')}
        variant="mobile"
        onBack={() => navigate('/settings')}
      />

      {/* ── Shared body ── */}
      <StatisticsScreenBody
        statistics={statistics as ServerStatistics | null}
        isLoading={isLoading}
        isConnected={isConnected}
        contentClassName="max-w-lg"
      />
    </div>
  );
}
