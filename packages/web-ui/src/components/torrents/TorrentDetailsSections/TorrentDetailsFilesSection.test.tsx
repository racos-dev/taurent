import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TorrentDetailsFilesSection } from './TorrentDetailsFilesSection';
import type { FilePriorityTarget } from './types';
import type { TorrentFile } from '@taurent/shared/types/qbittorrent';

function makeFile(overrides: Partial<TorrentFile>): TorrentFile {
  return {
    index: 0,
    name: 'file.txt',
    size: 100,
    progress: 0.5,
    priority: 1,
    is_seed: false,
    piece_range: [0, 1],
    availability: 1,
    ...overrides,
  };
}

const nestedFiles: TorrentFile[] = [
  makeFile({ index: 0, name: 'Season 1/Episode 1.mkv', size: 100, progress: 1, priority: 1 }),
  makeFile({ index: 1, name: 'Season 1/Episode 2.mkv', size: 300, progress: 0.5, priority: 6 }),
  makeFile({ index: 2, name: 'poster.jpg', size: 50, progress: 1, priority: 1 }),
];

describe('TorrentDetailsFilesSection mobile folder support', () => {
  it('renders nested files as expandable folder rows by default', () => {
    const { getByRole, getByText } = render(
      <TorrentDetailsFilesSection variant="mobile" files={nestedFiles} />,
    );

    const folder = getByRole('button', { name: 'Collapse folder Season 1' });
    expect(folder).toBeTruthy();
    expect(folder.className).toContain('select-none');
    expect(getByText('Episode 1.mkv')).toBeTruthy();
    expect(getByText('Episode 2.mkv')).toBeTruthy();
    expect(getByText('poster.jpg')).toBeTruthy();
  });

  it('collapses folder contents on folder tap', () => {
    const { getByRole, queryByText } = render(
      <TorrentDetailsFilesSection variant="mobile" files={nestedFiles} />,
    );

    fireEvent.click(getByRole('button', { name: 'Collapse folder Season 1' }));

    expect(getByRole('button', { name: 'Expand folder Season 1' })).toBeTruthy();
    expect(queryByText('Episode 1.mkv')).toBeNull();
    expect(queryByText('Episode 2.mkv')).toBeNull();
    expect(queryByText('poster.jpg')).toBeTruthy();
  });

  it('opens priority editing for all descendant files on folder long-press', () => {
    vi.useFakeTimers();
    const onFilePriorityTarget = vi.fn<void, [FilePriorityTarget]>();
    const { getByRole } = render(
      <TorrentDetailsFilesSection
        variant="mobile"
        files={nestedFiles}
        onFilePriorityTarget={onFilePriorityTarget}
      />,
    );

    fireEvent.pointerDown(getByRole('button', { name: 'Collapse folder Season 1' }), { button: 0 });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onFilePriorityTarget).toHaveBeenCalledWith({
      label: 'Season 1 (2 files)',
      currentPriority: -1,
      fileIds: [0, 1],
    });

    vi.useRealTimers();
  });

  it('opens priority editing for one file on file long-press', () => {
    vi.useFakeTimers();
    const onFilePriorityTarget = vi.fn<void, [FilePriorityTarget]>();
    const { getByText } = render(
      <TorrentDetailsFilesSection
        variant="mobile"
        files={nestedFiles}
        onFilePriorityTarget={onFilePriorityTarget}
      />,
    );

    fireEvent.pointerDown(getByText('poster.jpg').closest('.select-none') as Element, { button: 0 });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onFilePriorityTarget).toHaveBeenCalledWith({
      label: 'poster.jpg',
      currentPriority: 1,
      fileIds: [2],
    });

    vi.useRealTimers();
  });
});
