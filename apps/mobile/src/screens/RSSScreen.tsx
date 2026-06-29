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

export function RSSScreen() {
  const navigate = useNavigate();
  const model = useRssScreen();

  return (
    <div className={mobileScreenRootClassName({ height: 'full' })}>
      <ScreenHeader
        title="RSS Feeds"
        subtitle={model.isLoading ? 'Loading...' : `${model.rssItems.length} feeds, ${model.rssRules.length} rules`}
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
