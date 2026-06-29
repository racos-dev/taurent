export interface FilterTrackerSectionProps {
  /** Sorted tracker entries from deriveTrackerEntries(). */
  trackerEntries: Array<{
    trackerUrl: string;
    hostname: string;
    count: number;
  }>;
  /** Currently selected tracker URL, or null for "All Trackers". */
  selectedTracker: string | null;
  /** Called when the user selects a tracker (pass null for "All Trackers"). */
  onTrackerChange: (trackerUrl: string | null) => void;
  /** Icon shown on each row and in the empty state. Defaults to a globe icon. */
  icon?: React.ReactNode;
}
