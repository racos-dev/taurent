/**
 * Desktop RSS Screen.
 *
 * Wires the shared RSSScreenBody to desktop-specific data sources
 * (useRssScreenModel from web-core + useQBClient for capability).
 */

import { useQBClient } from '../connection';
import { useRssScreenModel, createRssAdapterFns } from '@taurent/web-core';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { RSSScreenBody } from '@taurent/web-ui';

export function RSSScreen() {
  const { serverId, sessionGeneration, isConnected, capabilities } = useQBClient();

  const { getRssItems, getRssRules, mutations } = createRssAdapterFns(BridgeAdapter.qBClient);

  const model = useRssScreenModel({
    scope: { serverId, sessionGeneration, isConnected },
    supported: capabilities?.supportsRss ?? null,
    getRssItems,
    getRssRules,
    mutations,
  });

  return (
    <div className="flex h-full flex-col bg-background">
      <RSSScreenBody
        variant="desktop"
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
    </div>
  );
}
