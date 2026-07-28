import { SkeletonBlock } from '@taurent/web-ui/components/shared/SkeletonBlock/SkeletonBlock';
import type { ReactNode } from 'react';

export type LazyContentKind =
  | 'settings'
  | 'statistics'
  | 'dialog'
  | 'add-torrent'
  | 'search'
  | 'rss'
  | 'workspace';

const CARD_ROWS = ['first', 'second', 'third'] as const;
const NAV_ROWS = ['one', 'two', 'three', 'four', 'five', 'six'] as const;

function SettingsFallback() {
  return (
    <div className="flex h-full min-h-0 bg-background">
      <aside className="w-56 shrink-0 border-r border-border bg-surface px-3 py-4">
        <SkeletonBlock width="5rem" height="0.75rem" background="bg-surface-interactive" className="mb-4" />
        <div className="space-y-3">
          {NAV_ROWS.map((row) => (
            <SkeletonBlock key={row} height="2rem" background="bg-surface-interactive" />
          ))}
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-hidden px-4 py-4">
        <SkeletonBlock width="8rem" height="1.5rem" className="mb-2" />
        <SkeletonBlock width="22rem" height="0.75rem" className="mb-6 max-w-full" />
        <div className="space-y-6">
          {CARD_ROWS.map((row) => (
            <section key={row}>
              <SkeletonBlock width="9rem" height="1rem" className="mb-4" />
              <div className="space-y-3 rounded-sm border border-border bg-surface p-4">
                <SkeletonBlock height="2rem" background="bg-surface-interactive" />
                <SkeletonBlock height="2rem" background="bg-surface-interactive" />
                <SkeletonBlock height="2rem" background="bg-surface-interactive" />
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

function StatisticsFallback() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-2 px-2 py-2">
      {CARD_ROWS.map((row) => (
        <div key={row} className="space-y-3 rounded-sm border border-border bg-surface p-3">
          <SkeletonBlock width="9rem" height="1rem" background="bg-surface-interactive" />
          <SkeletonBlock height="1.25rem" background="bg-surface-interactive" />
          <SkeletonBlock height="1.25rem" background="bg-surface-interactive" />
          <SkeletonBlock height="1.25rem" background="bg-surface-interactive" />
        </div>
      ))}
    </div>
  );
}

function FormFallback({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-4 p-4' : 'mx-auto w-full max-w-4xl space-y-4 p-4'}>
      <SkeletonBlock width="10rem" height="1.5rem" />
      <SkeletonBlock width="24rem" height="0.75rem" className="max-w-full" />
      <div className="space-y-4 rounded-sm border border-border bg-surface p-4">
        <SkeletonBlock height="2.5rem" background="bg-surface-interactive" />
        <SkeletonBlock height="2.5rem" background="bg-surface-interactive" />
        {!compact && <SkeletonBlock height="6rem" background="bg-surface-interactive" />}
        <div className="flex justify-end gap-2">
          <SkeletonBlock width="6rem" height="2rem" background="bg-surface-interactive" />
          <SkeletonBlock width="7rem" height="2rem" background="bg-surface-interactive" />
        </div>
      </div>
    </div>
  );
}

function getFallbackContent(kind: LazyContentKind): ReactNode {
  switch (kind) {
    case 'settings':
      return <SettingsFallback />;
    case 'statistics':
      return <StatisticsFallback />;
    case 'dialog':
      return <FormFallback compact />;
    default:
      return <FormFallback />;
  }
}

export function LazyContentFallback({ kind }: { kind: LazyContentKind }) {
  return (
    <div className="h-full bg-background text-text-primary" role="status" aria-label={`Loading ${kind}`}>
      {getFallbackContent(kind)}
    </div>
  );
}
