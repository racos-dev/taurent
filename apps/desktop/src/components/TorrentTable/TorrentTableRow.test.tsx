import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { ColumnDefinition } from '@/stores';
import { createTorrent } from '../../testing/fixtures/torrent';
import { TorrentTableRow } from './TorrentTableRow';

vi.mock('@taurent/web-ui', () => ({
  ProgressBar: () => <div data-testid="progress-bar" />,
}));

vi.mock('@/stores', () => ({
  useTorrentSelectionStore: {
    getState: () => ({
      selectTorrent: vi.fn(),
      toggleTorrent: vi.fn(),
    }),
  },
}));

const baseColumn = {
  field: 'name',
  formatter: () => '',
  defaultVisibility: true,
  minWidth: 80,
  sortable: true,
  resizable: true,
  deferred: false,
} satisfies Omit<ColumnDefinition, 'id' | 'labelKey' | 'align'>;

describe('TorrentTableRow', () => {
  it('aligns body cells from column metadata', () => {
    const columns: ColumnDefinition[] = [
      {
        ...baseColumn,
        id: 'left',
        labelKey: 'columns.left',
        align: 'left',
        formatter: () => 'Left',
      },
      {
        ...baseColumn,
        id: 'center',
        labelKey: 'columns.center',
        align: 'center',
        formatter: () => 'Center',
      },
      {
        ...baseColumn,
        id: 'right',
        labelKey: 'columns.right',
        align: 'right',
        formatter: () => 'Right',
      },
    ];

    const { container } = render(
      <table>
        <tbody>
          <TorrentTableRow
            columns={columns}
            columnWidths={{ left: 80, center: 80, right: 80 }}
            torrent={createTorrent(0)}
            rowIndex={0}
            isSelected={false}
            isFocused={false}
            onClick={vi.fn()}
          />
        </tbody>
      </table>,
    );

    const cells = container.querySelectorAll('td');

    expect(cells[0]?.classList.contains('text-left')).toBe(true);
    expect(cells[1]?.classList.contains('text-center')).toBe(true);
    expect(cells[2]?.classList.contains('text-right')).toBe(true);
  });
});
