/**
 * TorrentTable component tests — browser mode
 *
 * Tests:
 * - Rendering smoke: table renders headers and deterministically-provisioned rows
 *   for 100/1000/5000 torrents using mocked virtualizer
 * - Perf audit: one torrent change causes bounded row outer renders and
 *   the perf audit system correctly records row-level updates
 *
 * Virtualizer mocking:
 * - @tanstack/react-virtual is mocked to always return a fixed window of rows
 *   (overscan=5, visible window ≈ 20 rows) regardless of container height.
 *   This makes row-count assertions deterministic in jsdom.
 *
 * Store mock:
 * - useShellStore(selector) returns selector(shellState) — Zustand-compatible
 * - useShellStore.getState() exists for production event path compatibility
 * - Both mocks have complete shell/selection state shapes
 *
 * Perf audit:
 * - localStorage 'taurent:perf-audit' set to '1' before module import
 * - console.info spy captures [perf-audit] logs
 * - baseline counters flushed after initial render, then delta counters asserted
 */
// ─── Perf audit flag — must be set before TorrentTable import ──────────────────
// Module-level: set localStorage flag before all imports so perfAudit module
// cache (isPerfAuditEnabled) is initialized correctly.
if (typeof localStorage !== 'undefined') {
  localStorage.setItem('taurent:perf-audit', '1');
}

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { createTorrentList } from '../../testing/fixtures/torrent';
import type { Torrent } from '@taurent/shared/types/qbittorrent';
import type { SortField, SortDirection } from '@taurent/shared/stores';
import { flushCounters } from '@taurent/shared/utils/perfAudit';

function counterValue(message: string, key: string): number {
  const match = message.match(new RegExp(`(?:^|\\s)${key}=(\\d+)(?:\\s|$)`));
  return match ? Number.parseInt(match[1], 10) : 0;
}

// ─── Mock @tanstack/react-virtual ──────────────────────────────────────────────
//
// Deterministic virtualization: always return a fixed window of 20 rows.
// This makes rendered row counts predictable in jsdom where scroll heights are 0.
//
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(({ count }: { count: number }) => {
    const WINDOW = 20; // deterministic visible window
    const windowSize = Math.min(count, WINDOW);
    const items = Array.from({ length: windowSize }, (_, i) => ({
      index: i,
      start: i * 26, // ROW_HEIGHT = 26
      size: 26,
      key: String(i),
      measureRef: vi.fn(),
    }));
    return {
      getVirtualItems: () => items,
      getTotalSize: () => count * 26,
      getScrollElement: () => null,
      scrollToIndex: vi.fn(),
      scrollToOffset: vi.fn(),
    };
  }),
}));

// ─── Mock DnD kit ─────────────────────────────────────────────────────────────
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: vi.fn(),
  PointerSensor: vi.fn(() => ({})),
  KeyboardSensor: vi.fn(() => ({})),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  type: { DragEndEvent: {}, DragStartEvent: {} },
}));
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  horizontalListSortingStrategy: {},
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
}));
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Translate: { toString: () => '' } },
}));

// ─── Mock @/hooks/usePreferences ─────────────────────────────────────────────
vi.mock('@/hooks', () => ({
  usePreferences: vi.fn(() => ({
    preferences: { queueing_enabled: true },
  })),
}));

// ─── Mock @/stores ────────────────────────────────────────────────────────────
vi.mock('@/stores', () => {
  const columnOrder = [
    'priority', 'name', 'size', 'total_size', 'progress', 'state',
    'dlspeed', 'upspeed', 'eta', 'ratio', 'category', 'tags', 'date_added',
    'last_activity', 'tracker',
  ];
  const columnVisibility: Record<string, boolean> = columnOrder.reduce(
    (acc, id) => { acc[id] = true; return acc; },
    {} as Record<string, boolean>
  );
  const columnWidths: Record<string, number> = {
    priority: 50, name: 220, size: 90, total_size: 90, progress: 120,
    state: 90, dlspeed: 90, upspeed: 90, eta: 70, ratio: 70,
    category: 90, tags: 90, date_added: 110, last_activity: 100, tracker: 120,
  };
  const COLUMNS = columnOrder.map((id) => ({
    id,
    label: id,
    field: 'name' as keyof import('@taurent/shared/types/qbittorrent').Torrent,
    formatter: () => null as unknown,
    defaultVisibility: true,
    minWidth: columnWidths[id] ?? 80,
    align: 'left' as const,
    sortable: true,
    resizable: true,
    deferred: false,
  }));
  const columnMap: Record<string, (typeof COLUMNS)[number]> = {};
  for (const col of COLUMNS) columnMap[col.id] = col;

  const shellState = {
    columnVisibility,
    columnOrder,
    columnWidths,
    setColumnOrder: () => {},
    setColumnWidth: () => {},
    setColumnWidths: () => {},
    setColumnVisibility: () => {},
    sidebarWidth: 256,
    sidebarVisible: true,
    propertiesPaneVisible: false,
    propertiesPaneHeight: 280,
    propertiesPaneActiveTab: 'overview' as const,
    inWindowMenuBarVisible: false,
  };
  const selectionState = {
    selectedHashes: new Set<string>(),
    focusedHash: null,
    anchorHash: null,
    panelTorrentHash: null,
    visibleHashes: [] as string[],
    selectTorrent: () => {},
    deselectTorrent: () => {},
    toggleTorrent: () => {},
    selectAll: () => {},
    deselectAll: () => {},
    setSelectedHashes: () => {},
    setAnchorHash: () => {},
    setFocusedHash: () => {},
    setPanelTorrentHash: () => {},
    setVisibleHashes: () => {},
    hasSelection: () => false,
    getSelectionCount: () => 0,
  };

  // Zustand-style: with selector arg, call selector(state). Without, return state.
  // Also expose .getState() for production event paths.
  const createMockStore = (state: typeof shellState | typeof selectionState) => {
    const storeFn = (selector?: (s: typeof state) => unknown) => {
      if (selector) return selector(state);
      return state;
    };
    storeFn.getState = () => state;
    storeFn.setState = vi.fn();
    storeFn.subscribe = vi.fn(() => () => {});
    return storeFn;
  };

  const mockShellStore = createMockStore(shellState);
  const mockSelectionStore = createMockStore(selectionState);

  return {
    COLUMN_MAP: columnMap,
    COLUMN_REGISTRY: COLUMNS,
    DEFAULT_COLUMN_ORDER: columnOrder,
    DEFAULT_COLUMN_VISIBILITY: columnVisibility,
    DEFAULT_COLUMN_WIDTHS: columnWidths,
    normalizeColumnOrder: (o: string[]) => o,
    normalizeColumnVisibility: (v: Record<string, boolean>) => v,
    normalizeColumnWidths: (w: Record<string, number>) => w,
    useShellStore: mockShellStore,
    useTorrentSelectionStore: mockSelectionStore,
  };
});

// ─── Import component after all mocks ─────────────────────────────────────────
import { TorrentTable } from './TorrentTable';

type TorrentTableTestProps = ComponentProps<typeof TorrentTable>;

const defaultProps: Omit<TorrentTableTestProps, 'torrents'> = {
  selectedHashes: new Set<string>(),
  sortField: 'name' as SortField,
  sortDirection: 'asc' as SortDirection,
  onSort: vi.fn(),
  onTorrentClick: vi.fn(),
};

// ─── Smoke tests ───────────────────────────────────────────────────────────────

describe('TorrentTable — rendering smoke', () => {
  it('renders header with Name column for empty list', () => {
    const { container } = render(
      <div style={{ height: '600px', overflow: 'auto' }}>
        <TorrentTable torrents={[]} {...defaultProps} />
      </div>
    );
    const table = container.querySelector('table');
    expect(table).toBeTruthy();
    const thead = container.querySelector('thead');
    expect(thead).toBeTruthy();
    const headerCells = container.querySelectorAll('thead th');
    expect(headerCells.length).toBeGreaterThan(0);
  });

  it('renders 100 torrents with deterministic virtualizer rows', () => {
    const torrents = createTorrentList(100);
    const { container } = render(
      <div style={{ height: '600px', overflow: 'auto' }}>
        <TorrentTable torrents={torrents} {...defaultProps} />
      </div>
    );
    const table = container.querySelector('table');
    expect(table).toBeTruthy();
    const rows = container.querySelectorAll('tr[data-index]');
    // Mocked virtualizer returns 20 rows window
    expect(rows.length).toBe(20);
  });

  it('renders 1000 torrents with deterministic virtualizer rows', () => {
    const torrents = createTorrentList(1000);
    const { container } = render(
      <div style={{ height: '600px', overflow: 'auto' }}>
        <TorrentTable torrents={torrents} {...defaultProps} />
      </div>
    );
    const table = container.querySelector('table');
    expect(table).toBeTruthy();
    const rows = container.querySelectorAll('tr[data-index]');
    // Mocked virtualizer returns 20 rows window — much less than 1000
    expect(rows.length).toBe(20);
    expect(rows.length).toBeLessThan(1000);
  });

  it('renders 5000 torrents with deterministic virtualizer rows', () => {
    const torrents = createTorrentList(5000);
    const { container } = render(
      <div style={{ height: '600px', overflow: 'auto' }}>
        <TorrentTable torrents={torrents} {...defaultProps} />
      </div>
    );
    const table = container.querySelector('table');
    expect(table).toBeTruthy();
    const rows = container.querySelectorAll('tr[data-index]');
    // Mocked virtualizer returns 20 rows — much less than 5000
    expect(rows.length).toBe(20);
    expect(rows.length).toBeLessThan(5000);
  });
});

// ─── Delta update perf test ────────────────────────────────────────────────────

describe('TorrentTable — delta update row render count', () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Ensure perf audit flag is set before test (already set at module level)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('taurent:perf-audit', '1');
    }
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy?.mockRestore();
    // Clear after each so next test starts fresh
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('taurent:perf-audit');
    }
  });

  it('updating one torrent out of 100 causes bounded row outer renders', () => {
    const originalTorrents = createTorrentList(100);

    const { rerender } = render(
      <div style={{ height: '600px', overflow: 'auto' }}>
        <TorrentTable torrents={originalTorrents} {...defaultProps} />
      </div>
    );

    // Flush baseline counters after initial render
    flushCounters();
    consoleInfoSpy.mockClear();

    const modifiedTorrents: Torrent[] = [...originalTorrents];
    modifiedTorrents[5] = { ...modifiedTorrents[5], name: 'Modified Torrent 5' } as Torrent;

    rerender(
      <div style={{ height: '600px', overflow: 'auto' }}>
        <TorrentTable torrents={modifiedTorrents} {...defaultProps} />
      </div>
    );

    // Flush all counters after delta render
    flushCounters();

    // Verify perf audit logs exist for row and table
    const allCalls = consoleInfoSpy.mock.calls;
    const perfAuditCalls = allCalls.filter((call: unknown[]) =>
      typeof call[0] === 'string' && (call[0] as string).includes('[perf-audit]')
    );
    expect(perfAuditCalls.length).toBeGreaterThan(0);

    // There should be row outer render log entries
    const outerCalls = perfAuditCalls.filter((call: unknown[]) =>
      typeof call[0] === 'string' && (call[0] as string).includes('render.TorrentTableRow.outer')
    );
    expect(outerCalls.length).toBeGreaterThan(0);

    const outerRenderCount = outerCalls.reduce(
      (total: number, call: unknown[]) => total + counterValue(call[0] as string, 'render'),
      0,
    );
    const outerTorrentCount = outerCalls.reduce(
      (total: number, call: unknown[]) => total + counterValue(call[0] as string, 'torrent'),
      0,
    );

    // Bounded: only the changed visible row should rerender; allow small
    // overhead for React/browser-mode scheduling differences.
    expect(outerRenderCount).toBeGreaterThan(0);
    expect(outerRenderCount).toBeLessThanOrEqual(5);
    expect(outerTorrentCount).toBeGreaterThan(0);
    expect(outerTorrentCount).toBeLessThanOrEqual(5);

    // Verify table-level reason log includes torrents
    const tableReasonCalls = perfAuditCalls.filter((call: unknown[]) =>
      typeof call[0] === 'string' && (call[0] as string).includes('render.TorrentTable.reason')
    );
    const torrentsReasonLogged = tableReasonCalls.some((call: unknown[]) =>
      typeof call[0] === 'string' && (call[0] as string).includes('torrents')
    );
    expect(torrentsReasonLogged).toBe(true);
  });

  it('renders at least one visible row in virtualized list', () => {
    const torrents = createTorrentList(100);
    const { container } = render(
      <div style={{ height: '600px', overflow: 'auto' }}>
        <TorrentTable torrents={torrents} {...defaultProps} />
      </div>
    );
    const rows = container.querySelectorAll('tr[data-index]');
    expect(rows.length).toBeGreaterThan(0);
  });
});
