import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LazyContentFallback, type LazyContentKind } from './LazyContentFallback';

const FALLBACKS: ReadonlyArray<{ kind: LazyContentKind; testId: string; label: string }> = [
  { kind: 'settings', testId: 'settings-skeleton', label: 'Loading settings' },
  { kind: 'statistics', testId: 'statistics-skeleton', label: 'Loading statistics' },
  { kind: 'dialog', testId: 'dialog-skeleton', label: 'Loading dialog' },
  { kind: 'add-torrent', testId: 'add-torrent-skeleton', label: 'Loading add torrent' },
  { kind: 'search', testId: 'search-skeleton', label: 'Loading search' },
  { kind: 'rss', testId: 'rss-skeleton', label: 'Loading RSS' },
  { kind: 'app-shell', testId: 'app-shell-skeleton', label: 'Loading application' },
  { kind: 'torrent-list', testId: 'torrent-list-skeleton', label: 'Loading torrent list' },
  { kind: 'auth', testId: 'auth-skeleton', label: 'Loading authentication' },
  { kind: 'filters', testId: 'filters-skeleton', label: 'Loading filters' },
];

describe('LazyContentFallback', () => {
  it.each(FALLBACKS)('renders the $kind screen structure', ({ kind, testId, label }) => {
    render(<LazyContentFallback kind={kind} />);

    expect(screen.getByRole('status', { name: label })).toBeTruthy();
    expect(screen.getByTestId(testId)).toBeTruthy();
  });
});
