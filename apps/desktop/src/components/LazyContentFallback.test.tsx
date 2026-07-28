import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LazyContentFallback, type LazyContentKind } from './LazyContentFallback';

const FALLBACKS: ReadonlyArray<{ kind: LazyContentKind; testId: string }> = [
  { kind: 'settings', testId: 'settings-skeleton' },
  { kind: 'statistics', testId: 'statistics-skeleton' },
  { kind: 'dialog', testId: 'dialog-skeleton' },
  { kind: 'add-torrent', testId: 'add-torrent-skeleton' },
  { kind: 'search', testId: 'search-skeleton' },
  { kind: 'rss', testId: 'rss-skeleton' },
  { kind: 'app-shell', testId: 'app-shell-skeleton' },
  { kind: 'torrent-list', testId: 'torrent-list-skeleton' },
  { kind: 'auth', testId: 'auth-skeleton' },
  { kind: 'filters', testId: 'filters-skeleton' },
];

describe('LazyContentFallback', () => {
  it.each(FALLBACKS)('renders the $kind screen structure', ({ kind, testId }) => {
    render(<LazyContentFallback kind={kind} />);

    expect(screen.getByRole('status', { name: `Loading ${kind}` })).toBeTruthy();
    expect(screen.getByTestId(testId)).toBeTruthy();
  });
});
