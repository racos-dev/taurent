import { SkeletonBlock } from '@taurent/web-ui/components/shared/SkeletonBlock/SkeletonBlock';
import type { ReactNode } from 'react';

export type LazyContentKind =
  | 'settings'
  | 'statistics'
  | 'dialog'
  | 'add-torrent'
  | 'search'
  | 'rss'
  | 'app-shell'
  | 'torrent-list'
  | 'auth'
  | 'filters';

const CARD_ROWS = ['first', 'second', 'third'] as const;
const NAV_ROWS = ['one', 'two', 'three', 'four', 'five', 'six'] as const;
const TABLE_ROWS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'] as const;
const LIST_ROWS = ['one', 'two', 'three', 'four', 'five'] as const;
const TOOLBAR_BUTTONS = ['add', 'remove', 'resume', 'pause', 'force', 'up', 'down', 'top', 'bottom', 'sidebar', 'settings'] as const;
const TORRENT_NAME_WIDTHS = ['75%', '58%', '68%'] as const;
const SEARCH_RESULT_WIDTHS = ['68%', '82%'] as const;

function SettingsFallback(): ReactNode {
  return (
    <div className="flex h-full min-h-0 bg-background" data-testid="settings-skeleton">
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

function StatisticsFallback(): ReactNode {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-2 px-2 py-2" data-testid="statistics-skeleton">
      {CARD_ROWS.map((row, index) => (
        <section key={row} className="rounded-sm border border-border bg-surface p-3">
          <SkeletonBlock width="9rem" height="1rem" background="bg-surface-interactive" className="mb-3" />
          <div className="space-y-2">
            {TABLE_ROWS.slice(0, index === 1 ? 2 : 5).map((item) => (
              <div key={item} className="flex items-center justify-between gap-6">
                <SkeletonBlock width="8rem" height="0.75rem" background="bg-surface-interactive" />
                <SkeletonBlock width="5rem" height="0.75rem" background="bg-surface-interactive" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TorrentListFallback(): ReactNode {
  return (
    <div className="h-full min-w-0 overflow-hidden bg-background" data-testid="torrent-list-skeleton">
      <div className="grid h-7 grid-cols-[minmax(14rem,3fr)_6rem_7rem_6rem_7rem] items-center gap-4 border-b border-border bg-surface px-3">
        <SkeletonBlock width="5rem" height="0.75rem" background="bg-surface-interactive" />
        <SkeletonBlock width="3rem" height="0.75rem" background="bg-surface-interactive" />
        <SkeletonBlock width="4rem" height="0.75rem" background="bg-surface-interactive" />
        <SkeletonBlock width="3rem" height="0.75rem" background="bg-surface-interactive" />
        <SkeletonBlock width="4rem" height="0.75rem" background="bg-surface-interactive" />
      </div>
      {TABLE_ROWS.map((row, index) => (
        <div
          key={row}
          className="grid h-7 grid-cols-[minmax(14rem,3fr)_6rem_7rem_6rem_7rem] items-center gap-4 border-b border-border/60 px-3"
        >
          <div className="flex min-w-0 items-center gap-2">
            <SkeletonBlock width="0.75rem" height="0.75rem" />
            <SkeletonBlock width={TORRENT_NAME_WIDTHS[index % TORRENT_NAME_WIDTHS.length]} height="0.75rem" />
          </div>
          <SkeletonBlock width="3.5rem" height="0.75rem" />
          <SkeletonBlock height="0.5rem" />
          <SkeletonBlock width="3rem" height="0.75rem" />
          <SkeletonBlock width="4.5rem" height="0.75rem" />
        </div>
      ))}
    </div>
  );
}

function AppShellFallback(): ReactNode {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background" data-testid="app-shell-skeleton">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border bg-surface px-1">
        <div className="flex items-center gap-1">
          {TOOLBAR_BUTTONS.map((button) => (
            <SkeletonBlock key={button} width="1.75rem" height="1.75rem" background="bg-surface-interactive" />
          ))}
        </div>
        <div className="flex-1" />
        <SkeletonBlock width="10rem" height="1.75rem" background="bg-surface-interactive" />
        <div className="mx-1 h-5 w-px bg-border" />
        <SkeletonBlock width="4rem" height="1.75rem" background="bg-surface-interactive" />
        <SkeletonBlock width="3.5rem" height="1.75rem" background="bg-surface-interactive" />
        <SkeletonBlock width="3rem" height="1.75rem" background="bg-surface-interactive" />
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="w-56 shrink-0 border-r border-border bg-surface px-2 py-2">
          {CARD_ROWS.map((section, sectionIndex) => (
            <section key={section} className="mb-4">
              <div className="mb-2 flex items-center gap-2 px-1">
                <SkeletonBlock width="0.75rem" height="0.75rem" background="bg-surface-interactive" />
                <SkeletonBlock width={sectionIndex === 0 ? '4rem' : '5rem'} height="0.75rem" background="bg-surface-interactive" />
              </div>
              <div className="space-y-1">
                {LIST_ROWS.slice(0, sectionIndex === 0 ? 5 : 3).map((row) => (
                  <div key={row} className="flex h-6 items-center gap-2 px-2">
                    <SkeletonBlock width="0.75rem" height="0.75rem" background="bg-surface-interactive" />
                    <SkeletonBlock width="6rem" height="0.75rem" background="bg-surface-interactive" />
                    <SkeletonBlock width="1.5rem" height="0.75rem" background="bg-surface-interactive" className="ml-auto" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </aside>
        <main className="min-w-0 flex-1">
          <TorrentListFallback />
        </main>
      </div>

      <div className="flex h-7 shrink-0 items-center gap-5 border-t border-border bg-surface px-3">
        <SkeletonBlock width="7rem" height="0.75rem" background="bg-surface-interactive" />
        <SkeletonBlock width="5rem" height="0.75rem" background="bg-surface-interactive" />
        <div className="flex-1" />
        <SkeletonBlock width="6rem" height="0.75rem" background="bg-surface-interactive" />
        <SkeletonBlock width="6rem" height="0.75rem" background="bg-surface-interactive" />
      </div>
    </div>
  );
}

function AddTorrentFallback(): ReactNode {
  return (
    <div className="flex h-full flex-col bg-background" data-testid="add-torrent-skeleton">
      <div className="shrink-0 border-b border-border px-4 py-4">
        <SkeletonBlock width="7rem" height="1rem" />
      </div>
      <div className="flex-1 overflow-hidden px-4 py-4">
        <div className="space-y-4">
          <section>
            <SkeletonBlock width="8rem" height="1rem" className="mb-3" />
            <div className="space-y-4 rounded-sm border border-border bg-surface p-2">
              <SkeletonBlock width="5rem" height="0.75rem" />
              <SkeletonBlock height="2rem" background="bg-background" />
              <div className="flex items-center gap-2"><div className="flex-1 border-t border-border" /><SkeletonBlock width="1rem" height="0.5rem" /><div className="flex-1 border-t border-border" /></div>
              <SkeletonBlock height="4rem" background="bg-background" />
            </div>
          </section>
          <section>
            <SkeletonBlock width="5rem" height="1rem" className="mb-3" />
            <div className="grid grid-cols-2 gap-4 rounded-sm border border-border bg-surface p-2">
              <SkeletonBlock height="2rem" background="bg-background" className="col-span-2" />
              <SkeletonBlock height="2rem" background="bg-background" className="col-span-2" />
              <SkeletonBlock height="2rem" background="bg-background" />
              <SkeletonBlock height="2rem" background="bg-background" />
              <SkeletonBlock height="2rem" background="bg-background" className="col-span-2" />
            </div>
          </section>
        </div>
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-surface px-4 py-3">
        <SkeletonBlock width="5rem" height="2rem" background="bg-surface-interactive" />
        <SkeletonBlock width="7rem" height="2rem" background="bg-surface-interactive" />
      </div>
    </div>
  );
}

function SearchFallback(): ReactNode {
  return (
    <div className="flex h-full flex-col bg-background" data-testid="search-skeleton">
      <div className="border-b border-border bg-surface p-4">
        <div className="flex gap-2">
          <SkeletonBlock height="2rem" background="bg-surface-interactive" className="flex-1" />
          <SkeletonBlock width="5rem" height="2rem" background="bg-surface-interactive" />
        </div>
        <div className="mt-3 flex justify-between">
          <SkeletonBlock width="7rem" height="0.75rem" background="bg-surface-interactive" />
          <SkeletonBlock width="6rem" height="0.75rem" background="bg-surface-interactive" />
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-hidden p-4">
        {LIST_ROWS.map((row, index) => (
          <div key={row} className="rounded-sm border border-border bg-surface px-3 py-2">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <SkeletonBlock width={SEARCH_RESULT_WIDTHS[index % SEARCH_RESULT_WIDTHS.length]} height="0.75rem" background="bg-surface-interactive" />
                <div className="mt-2 flex gap-3">
                  <SkeletonBlock width="4rem" height="0.75rem" background="bg-surface-interactive" />
                  <SkeletonBlock width="5rem" height="0.75rem" background="bg-surface-interactive" />
                  <SkeletonBlock width="5rem" height="0.75rem" background="bg-surface-interactive" />
                </div>
              </div>
              <SkeletonBlock width="3rem" height="1.5rem" background="bg-surface-interactive" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RssFallback(): ReactNode {
  return (
    <div className="flex h-full flex-col bg-background" data-testid="rss-skeleton">
      <div className="flex h-10 shrink-0 items-end gap-6 border-b border-border bg-surface px-4">
        <SkeletonBlock width="5rem" height="1.75rem" background="bg-surface-interactive" />
        <SkeletonBlock width="5rem" height="1.75rem" background="bg-surface-interactive" />
      </div>
      <div className="border-b border-border p-4">
        <SkeletonBlock height="3rem" background="bg-surface" />
      </div>
      <div className="flex-1 space-y-2 overflow-hidden p-4">
        {LIST_ROWS.map((row, index) => (
          <div key={row} className="flex items-start gap-3 rounded-md border border-border bg-surface px-4 py-3">
            <SkeletonBlock width="1rem" height="1rem" background="bg-surface-interactive" />
            <div className="min-w-0 flex-1">
              <SkeletonBlock width={index % 2 === 0 ? '9rem' : '12rem'} height="0.75rem" background="bg-surface-interactive" />
              <SkeletonBlock width="60%" height="0.75rem" background="bg-surface-interactive" className="mt-2" />
            </div>
            <SkeletonBlock width="4rem" height="1.75rem" background="bg-surface-interactive" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DialogFallback(): ReactNode {
  return (
    <div className="flex h-full flex-col gap-4 p-5 pb-4" data-testid="dialog-skeleton">
      <div className="flex items-start gap-3">
        <SkeletonBlock width="2rem" height="2rem" background="bg-surface-interactive" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBlock width="10rem" height="0.875rem" />
          <SkeletonBlock width="90%" height="0.75rem" />
          <SkeletonBlock width="70%" height="0.75rem" />
        </div>
      </div>
      <div className="mt-auto flex justify-end gap-3 pt-4">
        <SkeletonBlock width="5rem" height="2rem" background="bg-surface-interactive" />
        <SkeletonBlock width="5rem" height="2rem" background="bg-surface-interactive" />
      </div>
    </div>
  );
}

function AuthFallback(): ReactNode {
  return (
    <div className="flex h-screen items-center justify-center bg-background p-4" data-testid="auth-skeleton">
      <div className="w-full max-w-md">
        <SkeletonBlock width="4rem" height="4rem" background="bg-surface-interactive" className="mx-auto mb-4" />
        <SkeletonBlock width="12rem" height="1.25rem" className="mx-auto mb-2" />
        <SkeletonBlock width="18rem" height="0.75rem" className="mx-auto mb-8 max-w-full" />
        <div className="space-y-3">
          {CARD_ROWS.map((row) => (
            <SkeletonBlock key={row} height="4.5rem" background="bg-surface" />
          ))}
          <SkeletonBlock height="3rem" background="bg-surface" />
        </div>
      </div>
    </div>
  );
}

function FiltersFallback(): ReactNode {
  return (
    <div className="flex h-full flex-col bg-background" data-testid="filters-skeleton">
      <div className="flex h-12 shrink-0 items-center border-b border-border bg-surface px-4">
        <SkeletonBlock width="5rem" height="1rem" background="bg-surface-interactive" />
      </div>
      <div className="flex-1 overflow-hidden p-4">
        <div className="mx-auto max-w-2xl space-y-3">
          {LIST_ROWS.map((row, index) => (
            <section key={row} className="rounded-sm border border-border bg-surface p-4">
              <div className="flex items-center gap-3">
                <SkeletonBlock width="1.25rem" height="1.25rem" background="bg-surface-interactive" />
                <SkeletonBlock width={index === 0 ? '4rem' : '6rem'} height="0.875rem" background="bg-surface-interactive" />
                <SkeletonBlock width="5rem" height="0.75rem" background="bg-surface-interactive" className="ml-auto" />
              </div>
            </section>
          ))}
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
      return <DialogFallback />;
    case 'add-torrent':
      return <AddTorrentFallback />;
    case 'search':
      return <SearchFallback />;
    case 'rss':
      return <RssFallback />;
    case 'app-shell':
      return <AppShellFallback />;
    case 'torrent-list':
      return <TorrentListFallback />;
    case 'auth':
      return <AuthFallback />;
    case 'filters':
      return <FiltersFallback />;
  }
}

export function LazyContentFallback({ kind }: { kind: LazyContentKind }): ReactNode {
  return (
    <div className="h-full bg-background text-text-primary" role="status" aria-label={`Loading ${kind}`}>
      {getFallbackContent(kind)}
    </div>
  );
}
