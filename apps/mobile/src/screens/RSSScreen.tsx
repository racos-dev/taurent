/**
 * Mobile RSS Screen.
 *
 * Wires the shared RSSScreenBody to mobile-specific data sources
 * (useRssScreenModel from web-core + useQBClient for capability).
 */

import { useNavigate } from 'react-router-dom';
import { RSSScreenBody, ScreenHeader } from '@taurent/web-ui';
import { useRssScreen } from '../hooks';
import { mobileScreenRootClassName } from '../ui/mobileScreenLayout';
import { useTaurentTranslation } from '@taurent/shared/i18n';

export function RSSScreen() {
  const navigate = useNavigate();
  const model = useRssScreen();
  const { t } = useTaurentTranslation('rss');

  return (
    <div className={mobileScreenRootClassName({ height: 'full' })}>
      <ScreenHeader
        title={t('title')}
        subtitle={model.isLoading
          ? t('loading')
          : t('summary', {
              count: model.rssItems.length + model.rssRules.length,
              feedCount: model.rssItems.length,
              ruleCount: model.rssRules.length,
            })}
        variant="mobile"
        onBack={() => navigate('/')}
      />

      {/* Shared body */}
      <main className="mx-auto w-full max-w-lg px-2 pb-[calc(2rem+var(--sab))]">
        <RSSScreenBody
          variant="mobile"
          isSupported={model.isSupported}
          isUnsupported={model.isUnsupported}
          isCapabilityLoading={model.isCapabilityLoading}
          rssItems={model.rssItems}
          rssRules={model.rssRules}
          rssRuleNames={model.rssRuleNames}
          isLoading={model.isLoading}
          error={model.error}
          onRefetch={model.onRefetch}
          onAddFeed={model.onAddFeed}
          onEditFeedUrl={model.onEditFeedUrl}
          onRemoveItem={model.onRemoveItem}
          isAddingFeed={model.isAddingFeed}
          isEditingFeedUrl={model.isEditingFeedUrl}
          isRemovingItem={model.isRemovingItem}
          onSetRule={model.onSetRule}
          onRenameRule={model.onRenameRule}
          onRemoveRule={model.onRemoveRule}
          isSettingRule={model.isSettingRule}
          isRenamingRule={model.isRenamingRule}
          isRemovingRule={model.isRemovingRule}
        />
      </main>
    </div>
  );
}
