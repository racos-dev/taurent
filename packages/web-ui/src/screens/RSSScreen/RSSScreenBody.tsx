import React, { useCallback, useState } from 'react';
import { cn, Icon, Edit2, Trash2 } from '@taurent/shared';
import { TabBar } from '@taurent/web-ui';
import { ExternalLink } from '../../components/shared/ExternalLink';
import { StateSurface } from '../../components/shared/StateSurface';
import { InfoRow } from '../../components/shared/InfoRow';
import { SkeletonBlock } from '../../components/shared/SkeletonBlock';
import { ConfirmDialog } from '../../components/dialogs/ConfirmDialog';
import { Dialog } from '../../components/dialogs/Dialog';
import { Input } from '../../components/primitives/Input';
import { Button } from '../../components/primitives/Button';
import { RetryButton } from '../../components/shared/RetryButton';
import { ToggleSwitch } from '../../components/primitives/ToggleSwitch';
import { useTaurentTranslation } from '@taurent/shared/i18n';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NormalizedRSSItem {
  name: string;
  url: string | null;
  isFolder: boolean;
  /** Canonical path used for feed edits/deletes (unique per item). */
  path: string;
  /** Optional stable ID when upstream RSS payload exposes one. */
  uid?: string | null;
}

export interface NormalizedRSSRule {
  name: string;
  enabled: boolean;
  mustContain: string;
  mustNotContain: string;
  useRegex: boolean;
  episodeFilter: string;
  smartFilter: boolean;
  affectedFeeds: string[];
  ignoreDays: number;
  lastMatch: string;
  addPaused: boolean;
  assignedCategory: string;
  savePath: string;
}

export interface RSSScreenProps {
  variant?: 'desktop' | 'mobile';
  // Capability state
  isSupported: boolean | null;
  isUnsupported: boolean;
  isCapabilityLoading: boolean;
  // Data
  rssItems: NormalizedRSSItem[];
  rssRules: NormalizedRSSRule[];
  rssRuleNames: string[];
  isLoading: boolean;
  error: Error | null;
  onRefetch: () => void;
  // Feed mutations
  onAddFeed: (path: string, url: string) => Promise<void>;
  onEditFeedUrl: (path: string, url: string) => Promise<void>;
  onRemoveItem: (path: string) => void;
  isAddingFeed: boolean;
  isEditingFeedUrl: boolean;
  isRemovingItem: boolean;
  // Rule mutations
  onSetRule: (ruleName: string, rule: WriteSafeRssRuleInput) => Promise<void>;
  onRenameRule: (ruleName: string, newRuleName: string) => Promise<void>;
  onRemoveRule: (ruleName: string) => void;
  isSettingRule: boolean;
  isRenamingRule: boolean;
  isRemovingRule: boolean;
}

/**
 * Write-safe subset of RSS rule fields — excludes server-owned read-only fields
 * like `lastMatch` and `previouslyMatchedEpisodes`.
 */
export interface WriteSafeRssRuleInput {
  enabled?: boolean;
  mustContain?: string;
  mustNotContain?: string;
  useRegex?: boolean;
  episodeFilter?: string;
  smartFilter?: boolean;
  affectedFeeds?: string[];
  ignoreDays?: number;
  /** Use explicit undefined for false to preserve false vs omitted distinction. */
  addPaused?: boolean | null;
  assignedCategory?: string;
  savePath?: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface RSSItemRowProps {
  item: NormalizedRSSItem;
  onEditFeedUrl: (item: NormalizedRSSItem) => void;
  onRemoveItem: (item: NormalizedRSSItem) => void;
  isEditing: boolean;
  isRemoving: boolean;
}

const RSSItemRow = React.memo<RSSItemRowProps>(({ item, onEditFeedUrl, onRemoveItem, isEditing, isRemoving }) => {
  const { t } = useTaurentTranslation('rss');

  return <div className="flex items-start gap-3 rounded-md border border-border bg-surface px-4 py-3">
      <div className="mt-1">
        <Icon name={item.isFolder ? 'folder' : 'rss'} className="h-4 w-4 text-text-secondary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span title={item.name} className="text-sm font-medium text-text-primary truncate">{item.name}</span>
          {item.isFolder && (
            <span className="shrink-0 rounded-sm bg-surface-interactive px-2 py-1 text-xs text-text-muted">
              {t('folder')}
            </span>
          )}
      </div>
      {item.url && (
        <ExternalLink
          href={item.url}
          className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Icon name="external-link" className="h-3 w-3" />
          {item.url}
        </ExternalLink>
      )}
    </div>
    {!item.isFolder && (
      <div className="flex gap-1 shrink-0">
        <button
          onClick={() => onEditFeedUrl(item)}
          disabled={isEditing || isRemoving}
          className="p-2 hover:bg-surface-interactive rounded-sm transition-colors disabled:text-text-disabled"
          aria-label={t('editFeedUrl')}
        >
          <Edit2 className="h-4 w-4 text-text-muted" />
        </button>
        <button
          onClick={() => onRemoveItem(item)}
          disabled={isEditing || isRemoving}
          className="p-2 hover:bg-error/10 rounded-sm transition-colors disabled:text-text-disabled"
          aria-label={t('removeFeed')}
        >
          <Trash2 className="h-4 w-4 text-error" />
        </button>
      </div>
    )}
  </div>;
});

RSSItemRow.displayName = 'RSSItemRow';

interface RSSRuleRowProps {
  rule: NormalizedRSSRule;
  onEdit: (rule: NormalizedRSSRule) => void;
  onRemove: (rule: NormalizedRSSRule) => void;
  isSetting: boolean;
  isRemoving: boolean;
}

const RSSRuleRow = React.memo<RSSRuleRowProps>(({ rule, onEdit, onRemove, isSetting, isRemoving }) => {
  const { t } = useTaurentTranslation('rss');

  return <div className="rounded-md border border-border bg-surface px-4 py-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span title={rule.name} className="text-sm font-medium text-text-primary truncate">{rule.name}</span>
          <span
            className={cn(
              'shrink-0 rounded-sm px-1 py-1 text-xs',
              rule.enabled
                ? 'bg-primary/10 text-primary'
                : 'bg-surface-interactive text-text-muted'
            )}
          >
            {rule.enabled ? t('enabled') : t('disabled')}
          </span>
        </div>

        <div className="mt-2 space-y-1">
          {rule.mustContain && (
            <InfoRow label={t('contains')} value={rule.mustContain} />
          )}
          {rule.mustNotContain && (
            <InfoRow label={t('excludes')} value={rule.mustNotContain} />
          )}
          {rule.episodeFilter && (
            <InfoRow label={t('episode')} value={rule.episodeFilter} />
          )}
          {rule.affectedFeeds.length > 0 && (
            <InfoRow label={t('feeds')} value={rule.affectedFeeds.join(', ')} />
          )}
          {rule.assignedCategory && (
            <InfoRow label={t('category')} value={rule.assignedCategory} />
          )}
          {rule.savePath && (
            <InfoRow label={t('savePath')} value={rule.savePath} />
          )}
          {rule.lastMatch && (
            <InfoRow label={t('lastMatch')} value={rule.lastMatch} />
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          onClick={() => onEdit(rule)}
          disabled={isSetting || isRemoving}
          className="p-2 hover:bg-surface-interactive rounded-sm transition-colors disabled:text-text-disabled"
          aria-label={t('editRule')}
        >
          <Edit2 className="h-4 w-4 text-text-muted" />
        </button>
        <button
          onClick={() => onRemove(rule)}
          disabled={isSetting || isRemoving}
          className="p-2 hover:bg-error/10 rounded-sm transition-colors disabled:text-text-disabled"
          aria-label={t('removeRule')}
        >
          <Trash2 className="h-4 w-4 text-error" />
        </button>
      </div>
    </div>
  </div>;
});

RSSRuleRow.displayName = 'RSSRuleRow';

// ---------------------------------------------------------------------------
// Feed Dialog (Add / Edit URL)
// ---------------------------------------------------------------------------

interface FeedDialogState {
  mode: 'add' | 'edit';
  item?: NormalizedRSSItem;
  path: string;
  url: string;
}

interface FeedDialogProps {
  isOpen: boolean;
  state: FeedDialogState;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (path: string, url: string) => Promise<void>;
}

const FeedDialog = React.memo<FeedDialogProps>(({ isOpen, state, isSubmitting, onClose, onSubmit }) => {
  const { t } = useTaurentTranslation('rss');
  const [path, setPath] = useState(state.path);
  const [url, setUrl] = useState(state.url);

  // Reset form when dialog opens with new state
  React.useEffect(() => {
    setPath(state.path);
    setUrl(state.url);
  }, [state.path, state.url, isOpen]);

  const handleSubmit = async () => {
    try {
      await onSubmit(path, url);
      onClose();
    } catch {
      // keep dialog open on failure — error surfaced via mutation error
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={state.mode === 'add' ? t('addFeed') : t('editFeed')}
      description={state.mode === 'add' ? t('addFeedDescription') : t('editFeedDescription', { name: state.item?.name })}
      maxWidth="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !url.trim()}
          >
            {isSubmitting ? t('saving') : state.mode === 'add' ? t('addFeed') : t('save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {state.mode === 'add' && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t('folderPath')}
            </label>
            <Input
              value={path}
              onChange={setPath}
              placeholder={t('folderPathPlaceholder')}
              className="w-full"
            />
            <p className="mt-1 text-xs text-text-muted">
              {t('folderPathHint')}
            </p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            {t('feedUrl')} <span className="text-error">*</span>
          </label>
          <Input
            value={url}
            onChange={setUrl}
            placeholder={t('feedUrlExample')}
            className="w-full"
            autoFocus
          />
        </div>
      </div>
    </Dialog>
  );
});

FeedDialog.displayName = 'FeedDialog';

// ---------------------------------------------------------------------------
// Rule Editor Dialog
// ---------------------------------------------------------------------------

interface RuleEditorProps {
  isOpen: boolean;
  initialRule: NormalizedRSSRule | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (ruleName: string, rule: WriteSafeRssRuleInput) => Promise<void>;
  onRename?: (ruleName: string, newRuleName: string) => Promise<void>;
  isRenaming?: boolean;
}

const RuleEditor = React.memo<RuleEditorProps>(({
  isOpen,
  initialRule,
  isSubmitting,
  onClose,
  onSubmit,
  onRename,
  isRenaming,
}) => {
  const { t } = useTaurentTranslation('rss');
  const [ruleName, setRuleName] = useState(initialRule?.name ?? '');
  const [newRuleName, setNewRuleName] = useState(initialRule?.name ?? '');
  const [enabled, setEnabled] = useState(initialRule?.enabled ?? true);
  const [mustContain, setMustContain] = useState(initialRule?.mustContain ?? '');
  const [mustNotContain, setMustNotContain] = useState(initialRule?.mustNotContain ?? '');
  const [useRegex, setUseRegex] = useState(initialRule?.useRegex ?? false);
  const [episodeFilter, setEpisodeFilter] = useState(initialRule?.episodeFilter ?? '');
  const [smartFilter, setSmartFilter] = useState(initialRule?.smartFilter ?? false);
  const [affectedFeeds, setAffectedFeeds] = useState(initialRule?.affectedFeeds.join('\n') ?? '');
  const [assignedCategory, setAssignedCategory] = useState(initialRule?.assignedCategory ?? '');
  const [savePath, setSavePath] = useState(initialRule?.savePath ?? '');
  const [addPaused, setAddPaused] = useState(initialRule?.addPaused ?? false);
  const [ignoreDays, setIgnoreDays] = useState(initialRule?.ignoreDays ?? 0);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setRuleName(initialRule?.name ?? '');
      setNewRuleName(initialRule?.name ?? '');
      setEnabled(initialRule?.enabled ?? true);
      setMustContain(initialRule?.mustContain ?? '');
      setMustNotContain(initialRule?.mustNotContain ?? '');
      setUseRegex(initialRule?.useRegex ?? false);
      setEpisodeFilter(initialRule?.episodeFilter ?? '');
      setSmartFilter(initialRule?.smartFilter ?? false);
      setAffectedFeeds(initialRule?.affectedFeeds.join('\n') ?? '');
      setAssignedCategory(initialRule?.assignedCategory ?? '');
      setSavePath(initialRule?.savePath ?? '');
      setAddPaused(initialRule?.addPaused ?? false);
      setIgnoreDays(initialRule?.ignoreDays ?? 0);
    }
  }, [initialRule, isOpen]);

  const isCreate = !initialRule;

  const handleSubmit = async () => {
    const feeds = affectedFeeds
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);

    const rule: WriteSafeRssRuleInput = {
      enabled,
      mustContain: mustContain || undefined,
      mustNotContain: mustNotContain || undefined,
      useRegex,
      episodeFilter: episodeFilter || undefined,
      smartFilter,
      affectedFeeds: feeds.length > 0 ? feeds : undefined,
      assignedCategory: assignedCategory || undefined,
      savePath: savePath || undefined,
      // Preserve explicit false — use ?? so false is not collapsed to undefined
      addPaused: addPaused ?? undefined,
      // Preserve explicit 0 — only omit if undefined (not passed)
      ignoreDays: ignoreDays === 0 ? 0 : ignoreDays > 0 ? ignoreDays : undefined,
    };

    try {
      await onSubmit(ruleName, rule);
      onClose();
    } catch {
      // keep dialog open on failure — error surfaced via mutation error
    }
  };

  const handleRename = async () => {
    if (onRename && initialRule && newRuleName.trim() && newRuleName !== initialRule.name) {
      try {
        await onRename(initialRule.name, newRuleName.trim());
        onClose();
      } catch {
        // keep dialog open on failure — error surfaced via mutation error
      }
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isCreate ? t('createRule') : t('editRuleTitle', { name: initialRule?.name })}
      maxWidth="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting || isRenaming}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isRenaming || !ruleName.trim()}
          >
            {isSubmitting ? t('saving') : isCreate ? t('createRule') : t('saveRule')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Rule name — editable only in create mode */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            {t('ruleName')} <span className="text-error">*</span>
          </label>
          {isCreate ? (
            <Input
              value={ruleName}
              onChange={setRuleName}
              placeholder={t('ruleNameExample')}
              className="w-full"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex-1 rounded-md border border-border bg-surface-interactive px-3 py-2 text-sm text-text-primary">
                {initialRule?.name}
              </span>
              <span className="text-xs text-text-muted">{t('readOnly')}</span>
            </div>
          )}
        </div>

        {/* Rename row (only when editing) */}
        {!isCreate && onRename && (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {t('newName')}
              </label>
              <Input
                value={newRuleName}
                onChange={setNewRuleName}
                placeholder={t('newNamePlaceholder')}
                className="w-full"
              />
            </div>
            <Button
              variant="secondary"
              onClick={handleRename}
              disabled={isRenaming || !newRuleName.trim() || newRuleName === initialRule?.name}
            >
              {t('rename')}
            </Button>
          </div>
        )}

        {/* Enabled toggle */}
        <div className="flex items-center gap-3">
          <ToggleSwitch
            checked={enabled}
            onChange={setEnabled}
          />
          <span className="text-sm text-text-primary">{t('ruleEnabled')}</span>
        </div>

        {/* Must contain */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            {t('mustContain')}
          </label>
          <Input
            value={mustContain}
            onChange={setMustContain}
            placeholder={t('mustContainExample')}
            className="w-full"
          />
        </div>

        {/* Must not contain */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            {t('mustNotContain')}
          </label>
          <Input
            value={mustNotContain}
            onChange={setMustNotContain}
            placeholder={t('mustNotContainExample')}
            className="w-full"
          />
        </div>

        {/* Regex toggle */}
        <div className="flex items-center gap-3">
          <ToggleSwitch
            checked={useRegex}
            onChange={setUseRegex}
          />
          <span className="text-sm text-text-primary">{t('useRegex')}</span>
        </div>

        {/* Episode filter */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            {t('episodeFilter')}
          </label>
          <Input
            value={episodeFilter}
            onChange={setEpisodeFilter}
            placeholder={t('episodeFilterExample')}
            className="w-full"
          />
        </div>

        {/* Smart filter toggle */}
        <div className="flex items-center gap-3">
          <ToggleSwitch
            checked={smartFilter}
            onChange={setSmartFilter}
          />
          <span className="text-sm text-text-primary">{t('smartEpisodeFilter')}</span>
        </div>

        {/* Affected feeds */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            {t('affectedFeeds')} <span className="text-text-muted">{t('affectedFeedsHint')}</span>
          </label>
          <textarea
            value={affectedFeeds}
            onChange={(e) => setAffectedFeeds(e.target.value)}
            placeholder={t('feedUrlExample')}
            rows={3}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-none resize-none"
          />
        </div>

        {/* Assigned category */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            {t('assignedCategory')}
          </label>
          <Input
            value={assignedCategory}
            onChange={setAssignedCategory}
            placeholder={t('categoryExample')}
            className="w-full"
          />
        </div>

        {/* Save path */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            {t('savePath')}
          </label>
          <Input
            value={savePath}
            onChange={setSavePath}
            placeholder={t('savePathExample')}
            className="w-full"
          />
        </div>

        {/* Add paused */}
        <div className="flex items-center gap-3">
          <ToggleSwitch
            checked={addPaused}
            onChange={setAddPaused}
          />
          <span className="text-sm text-text-primary">{t('addPaused')}</span>
        </div>

        {/* Ignore days */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            {t('minimumEpisodeInterval')}
          </label>
          <Input
            value={ignoreDays > 0 ? String(ignoreDays) : ''}
            onChange={(v) => setIgnoreDays(parseInt(v, 10) || 0)}
            placeholder="0"
            className="w-full"
          />
        </div>
      </div>
    </Dialog>
  );
});

RuleEditor.displayName = 'RuleEditor';

// ---------------------------------------------------------------------------
// Main RSSScreenBody
// ---------------------------------------------------------------------------

export const RSSScreenBody = React.memo<RSSScreenProps>(({
  variant = 'desktop',
  isSupported,
  isUnsupported,
  isCapabilityLoading,
  rssItems,
  rssRules,
  isLoading,
  error,
  onRefetch,
  onAddFeed,
  onEditFeedUrl,
  onRemoveItem,
  isAddingFeed,
  isEditingFeedUrl,
  isRemovingItem,
  onSetRule,
  onRenameRule,
  onRemoveRule,
  isSettingRule,
  isRenamingRule,
  isRemovingRule,
}) => {
  const { t } = useTaurentTranslation('rss');
  const [activeTab, setActiveTab] = useState<'feeds' | 'rules'>('feeds');

  // Feed dialog state
  const [feedDialogOpen, setFeedDialogOpen] = useState(false);
  const [feedDialogState, setFeedDialogState] = useState<FeedDialogState>({ mode: 'add', path: '', url: '' });

  // Rule editor state
  const [ruleEditorOpen, setRuleEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NormalizedRSSRule | null>(null);

  // Delete confirm state
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ type: 'feed' | 'rule'; name: string; path: string } | null>(null);

  // Stable dialog close handlers
  const handleCloseFeedDialog = useCallback(() => setFeedDialogOpen(false), []);
  const handleCloseRuleEditor = useCallback(() => setRuleEditorOpen(false), []);

  // ---- Feed handlers ----

  const handleOpenAddFeed = () => {
    setFeedDialogState({ mode: 'add', path: '', url: '' });
    setFeedDialogOpen(true);
  };

  const handleOpenEditFeedUrl = (item: NormalizedRSSItem) => {
    setFeedDialogState({ mode: 'edit', item, path: item.path, url: item.url ?? '' });
    setFeedDialogOpen(true);
  };

  const handleFeedSubmit = async (path: string, url: string) => {
    // Normalize forward slashes to backslashes (qB uses backslash as RSS path sep)
    const normalizedPath = path.replace(/\//g, '\\');
    if (feedDialogState.mode === 'add') {
      await onAddFeed(normalizedPath, url);
    } else if (feedDialogState.item) {
      await onEditFeedUrl(feedDialogState.item.path, url);
    }
    // Only close on success — failure is surfaced via mutation error, dialog stays open
    setFeedDialogOpen(false);
  };

  const handleRemoveItem = (item: NormalizedRSSItem) => {
    setDeleteConfirmTarget({ type: 'feed', name: item.name, path: item.path });
  };

  // ---- Rule handlers ----

  const handleOpenCreateRule = () => {
    setEditingRule(null);
    setRuleEditorOpen(true);
  };

  const handleOpenEditRule = (rule: NormalizedRSSRule) => {
    setEditingRule(rule);
    setRuleEditorOpen(true);
  };

  const handleRuleSubmit = async (ruleName: string, rule: WriteSafeRssRuleInput) => {
    try {
      await onSetRule(ruleName, rule);
      setRuleEditorOpen(false);
    } catch {
      // keep editor open on failure — error surfaced via mutation error
    }
  };

  const handleRenameRule = async (ruleName: string, newRuleName: string) => {
    await onRenameRule(ruleName, newRuleName);
  };

  const handleRemoveRule = (rule: NormalizedRSSRule) => {
    setDeleteConfirmTarget({ type: 'rule', name: rule.name, path: rule.name });
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmTarget) {
      if (deleteConfirmTarget.type === 'feed') {
        onRemoveItem(deleteConfirmTarget.path);
      } else {
        onRemoveRule(deleteConfirmTarget.name);
      }
    }
    setDeleteConfirmTarget(null);
  };

  // Capability states
  if (isCapabilityLoading) {
    return (
      <StateSurface
        tone="loading"
        title={t('checking')}
        message={t('checkingMessage')}
        icon={<Icon name="rss" className="h-6 w-6" />}
      />
    );
  }

  if (isUnsupported) {
    return (
      <StateSurface
        tone="unsupported"
        title={t('unsupported')}
        message={t('unsupportedMessage')}
        icon={<Icon name="rss" className="h-6 w-6" />}
      />
    );
  }

  if (isSupported === null) {
    return (
      <StateSurface
        tone="offline"
        title={t('unavailable')}
        message={t('unavailableMessage')}
        icon={<Icon name="rss" className="h-6 w-6" />}
      />
    );
  }

  const isCompact = variant === 'mobile';

  const tabs = [
    { id: 'feeds' as const, label: t('feedsTab', { count: rssItems.length }) },
    { id: 'rules' as const, label: t('rulesTab', { count: rssRules.length }) },
  ];

  return (
    <div className={cn('flex flex-col bg-background', isCompact ? 'min-h-screen pb-20' : 'h-full')}>
      {/* Tab Bar */}
      <TabBar
        variant="underline"
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as 'feeds' | 'rules')}
      />

      {/* Error State */}
      {error && (
        <div className="border-b border-border bg-error/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Icon name="alert" className="h-4 w-4 text-error" />
            <p className="text-xs text-error">{t('loadFailed')}</p>
            <RetryButton onClick={onRefetch} className="ml-auto" />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto overscroll-none">
        {isLoading ? (
          <div className={cn('space-y-2', isCompact ? 'p-4' : 'p-4')}>
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonBlock key={i} height={16} radius="md" background="bg-surface-interactive" />
            ))}
          </div>
        ) : activeTab === 'feeds' ? (
          <div>
            {/* Add Feed Button */}
            <div className={cn('border-b border-border', isCompact ? 'p-4' : 'p-4')}>
              <button
                onClick={handleOpenAddFeed}
                disabled={isAddingFeed || isEditingFeedUrl || isRemovingItem}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-border px-4 py-3 text-sm font-medium transition-colors',
                  'text-text-secondary hover:border-primary hover:text-primary disabled:text-text-disabled'
                )}
              >
                <Icon name="plus" className="h-4 w-4" />
                {t('addFeed')}
              </button>
            </div>

            {rssItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Icon name="rss" className="h-8 w-8 text-text-muted" />
                <p className="mt-3 text-sm text-text-secondary">{t('noFeeds')}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {t('noFeedsHint')}
                </p>
              </div>
            ) : (
              <div className={cn('space-y-2', isCompact ? 'p-4' : 'p-4')}>
                {rssItems.map((item) => (
                  <RSSItemRow
                    key={item.path}
                    item={item}
                    onEditFeedUrl={handleOpenEditFeedUrl}
                    onRemoveItem={handleRemoveItem}
                    isEditing={isEditingFeedUrl}
                    isRemoving={isRemovingItem}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Add Rule Button */}
            <div className={cn('border-b border-border', isCompact ? 'p-4' : 'p-4')}>
              <button
                onClick={handleOpenCreateRule}
                disabled={isSettingRule || isRenamingRule || isRemovingRule}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-border px-4 py-3 text-sm font-medium transition-colors',
                  'text-text-secondary hover:border-primary hover:text-primary disabled:text-text-disabled'
                )}
              >
                <Icon name="plus" className="h-4 w-4" />
                {t('createRule')}
              </button>
            </div>

            {rssRules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Icon name="filter" className="h-8 w-8 text-text-muted" />
                <p className="mt-3 text-sm text-text-secondary">{t('noRules')}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {t('noRulesHint')}
                </p>
              </div>
            ) : (
              <div className={cn('space-y-2', isCompact ? 'p-4' : 'p-4')}>
                {rssRules.map((rule) => (
                  <RSSRuleRow
                    key={rule.name}
                    rule={rule}
                    onEdit={handleOpenEditRule}
                    onRemove={handleRemoveRule}
                    isSetting={isSettingRule}
                    isRemoving={isRemovingRule}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Feed Dialog */}
      <FeedDialog
        isOpen={feedDialogOpen}
        state={feedDialogState}
        isSubmitting={isAddingFeed || isEditingFeedUrl}
        onClose={handleCloseFeedDialog}
        onSubmit={handleFeedSubmit}
      />

      {/* Rule Editor Dialog */}
      <RuleEditor
        isOpen={ruleEditorOpen}
        initialRule={editingRule}
        isSubmitting={isSettingRule}
        isRenaming={isRenamingRule}
        onClose={handleCloseRuleEditor}
        onSubmit={handleRuleSubmit}
        onRename={handleRenameRule}
      />

      {/* Delete Confirmation */}
      {deleteConfirmTarget && (
        <ConfirmDialog
          title={deleteConfirmTarget.type === 'feed' ? t('deleteFeedTitle') : t('deleteRuleTitle')}
          message={
            deleteConfirmTarget.type === 'feed'
              ? t('deleteFeedMessage', { name: deleteConfirmTarget.name })
              : t('deleteRuleMessage', { name: deleteConfirmTarget.name })
          }
          confirmLabel={t('common:actions.delete')}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setDeleteConfirmTarget(null);
          }}
          tone="danger"
        />
      )}
    </div>
  );
});

RSSScreenBody.displayName = 'RSSScreenBody';
