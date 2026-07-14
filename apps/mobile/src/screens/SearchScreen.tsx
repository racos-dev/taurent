/**
 * Mobile Search Screen - Phase 6.
 *
 * Wires the shared SearchScreenBody to mobile-specific data sources
 * (useSearchScreenModel from web-core + useQBClient for capability).
 */

import { useNavigate } from 'react-router-dom';
import { ScreenHeader, SearchScreenBody } from '@taurent/web-ui';
import { useSearchScreen } from '../hooks';
import { mobileScreenRootClassName } from '../ui/mobileScreenLayout';

export function SearchScreen() {
  const navigate = useNavigate();
  const model = useSearchScreen();

  return (
    <div className={mobileScreenRootClassName({ height: 'full' })}>
      <ScreenHeader
        title="Search"
        subtitle={model.isSearching ? 'Searching...' : 'Find torrents'}
        variant="mobile"
        onBack={() => navigate('/')}
      />

      {/* Shared body */}
      <main className="mx-auto w-full max-w-lg px-2 pb-[calc(2rem+var(--sab))]">
        <SearchScreenBody
          variant="mobile"
          isSupported={model.isSupported}
          isUnsupported={model.isUnsupported}
          isCapabilityLoading={model.isCapabilityLoading}
          query={model.query}
          onQueryChange={model.setQuery}
          selectedCategory={model.selectedCategory}
          onCategoryChange={model.setSelectedCategory}
          selectedPlugins={model.selectedPlugins}
          onPluginsChange={model.setSelectedPlugins}
          isSearching={model.isSearching}
          searchError={model.searchError}
          onStartSearch={model.onStartSearch}
          onStopSearch={model.onStopSearch}
          searchResults={model.searchResults}
          currentResultsTotal={model.currentResultsTotal}
          isLoadingResults={model.isLoadingResults}
          sortKey={model.sortKey}
          sortDirection={model.sortDirection}
          onSortKeyChange={model.setSortKey}
          onSortDirectionChange={model.setSortDirection}
          plugins={model.plugins}
          isLoadingPlugins={model.isLoadingPlugins}
          pluginsError={model.pluginsError}
          isPluginActionPending={model.isPluginActionPending}
          onEnablePlugin={model.onEnablePlugin}
          onUninstallPlugin={model.onUninstallPlugin}
          onInstallPlugin={model.onInstallPlugin}
          onUpdatePlugins={model.onUpdatePlugins}
          onAddResult={model.onAddResult}
        />
      </main>
    </div>
  );
}
